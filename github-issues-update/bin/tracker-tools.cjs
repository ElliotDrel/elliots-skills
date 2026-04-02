#!/usr/bin/env node

/**
 * tracker-tools.cjs — Data service layer for github-issues-update skill.
 *
 * Commands:
 *   parse-tracker <path>                  Parse tracker.md into structured JSON
 *   compile-report --temp-dir <dir> --date <YYYY-MM-DD>  Build overview from result files
 *   update-tracker --tracker <path> --temp-dir <dir> --date <YYYY-MM-DD>  Apply changes
 *   init-temp                             Create temp directory, print path
 *   validate --temp-dir <dir> --tracker <path> --expected <N>  Check completeness
 *
 * Zero dependencies. Deterministic output. The agent calls this; it cannot "forget".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── CLI Router ─────────────────────────────────────────────────────────────

const [,, command, ...rawArgs] = process.argv;

const commands = {
  'parse-tracker': cmdParseTracker,
  'compile-report': cmdCompileReport,
  'update-tracker': cmdUpdateTracker,
  'init-temp': cmdInitTemp,
  'validate': cmdValidate,
};

if (!command || !commands[command]) {
  console.error(`Usage: tracker-tools.cjs <command> [options]`);
  console.error(`Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

// Parse --flag value pairs from rawArgs
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    } else if (!flags._positional) {
      flags._positional = args[i];
    }
  }
  return flags;
}

const flags = parseFlags(rawArgs);

try {
  commands[command](flags);
} catch (err) {
  console.error(`Error in ${command}: ${err.message}`);
  process.exit(1);
}

// ─── Frontmatter Parser ────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    // Boolean
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    // Number
    else if (/^\d+$/.test(val)) val = parseInt(val, 10);
    // Comma-separated list
    else if (val.includes(',') && !val.startsWith('"')) {
      val = val.split(',').map(s => s.trim()).filter(Boolean);
    }
    // Strip surrounding quotes
    else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }

    meta[key] = val;
  }

  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

// ─── Tracker Parser ─────────────────────────────────────────────────────────

function parseTrackerFile(content) {
  const result = {
    username: null,
    active_issues: [],
    closed_issues: [],
    raw: content,
  };

  // Extract username
  const userMatch = content.match(/GitHub username:\s*\*\*(.+?)\*\*/);
  if (userMatch) result.username = userMatch[1];

  // Split into Active and Closed sections
  const activeSectionMatch = content.match(
    /## Active Issues[^\n]*\n([\s\S]*?)(?=\n## (?!Active)|$)/
  );
  const closedSectionMatch = content.match(
    /## Closed[^\n]*\n([\s\S]*?)(?=\n## (?!Closed)|$)/
  );

  if (activeSectionMatch) {
    result.active_issues = parseIssueSections(activeSectionMatch[1]);
  }
  if (closedSectionMatch) {
    result.closed_issues = parseClosedSections(closedSectionMatch[1]);
  }

  return result;
}

function parseIssueSections(sectionContent) {
  const issues = [];
  // Split by ### headers
  const parts = sectionContent.split(/(?=^### )/m).filter(p => p.trim());

  for (const part of parts) {
    // Skip HTML comments
    if (part.trim().startsWith('<!--')) continue;

    const issue = parseIssueBlock(part);
    if (issue) issues.push(issue);
  }
  return issues;
}

function parseIssueBlock(block) {
  // Parse header: ### owner/repo#NUMBER — Title
  const headerMatch = block.match(
    /^### ([^/]+)\/([^#]+)#(\d+)\s*[—–-]\s*(.+)/m
  );
  if (!headerMatch) return null;

  const issue = {
    owner: headerMatch[1].trim(),
    repo: headerMatch[2].trim(),
    number: parseInt(headerMatch[3], 10),
    title: headerMatch[4].trim(),
    role: extractField(block, 'Role'),
    filed: extractField(block, 'Filed'),
    last_check_date: null,
    status_summary: extractField(block, 'Status as of'),
    what_to_check: extractField(block, 'What to check'),
    related: extractListField(block, 'Related'),
    upstream: extractUpstream(block),
    duplicates: extractNestedItems(block, 'Duplicates found'),
    adjacent: extractNestedItems(block, 'Adjacent issues found'),
    next_steps: extractField(block, 'Next steps \\(now\\)'),
    future: extractField(block, 'Future'),
  };

  // Extract last check date from "Status as of YYYY-MM-DD:"
  const dateMatch = block.match(/\*\*Status as of (\d{4}-\d{2}-\d{2})\*\*/);
  if (dateMatch) issue.last_check_date = dateMatch[1];

  return issue;
}

function extractField(block, fieldName) {
  const re = new RegExp(`\\*\\*${fieldName}(?:\\s+\\S+)?[.:]*\\*\\*\\s*(.+)`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : null;
}

function extractListField(block, fieldName) {
  const val = extractField(block, fieldName);
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

function extractUpstream(block) {
  const val = extractField(block, 'Upstream');
  if (!val || val.toLowerCase() === 'n/a' || val === 'none') return null;
  const match = val.match(/([^/]+)\/([^#]+)#(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

function extractNestedItems(block, sectionName) {
  const items = [];
  const re = new RegExp(`\\*\\*${sectionName}[^*]*\\*\\*[:\\s]*\\n([\\s\\S]*?)(?=\\n- \\*\\*[A-Z]|$)`, 'i');
  const match = block.match(re);
  if (!match) return items;

  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const itemMatch = line.match(/^\s+-\s+\*\*#?(\d+)\*\*\s*[—–-]\s*(.+)/);
    if (itemMatch) {
      items.push({
        number: parseInt(itemMatch[1], 10),
        detail: itemMatch[2].trim(),
      });
    }
  }
  return items;
}

function parseClosedSections(sectionContent) {
  const issues = [];
  const parts = sectionContent.split(/(?=^### )/m).filter(p => p.trim());

  for (const part of parts) {
    if (part.trim().startsWith('<!--')) continue;
    const headerMatch = part.match(
      /^### ([^/]+)\/([^#]+)#(\d+)\s*[—–-]\s*(.+)/m
    );
    if (!headerMatch) continue;

    const lines = part.split(/\r?\n/).slice(1).filter(l => l.trim().startsWith('-'));
    issues.push({
      owner: headerMatch[1].trim(),
      repo: headerMatch[2].trim(),
      number: parseInt(headerMatch[3], 10),
      title: headerMatch[4].trim(),
      resolution: lines.map(l => l.replace(/^-\s*/, '').trim()).join(' '),
    });
  }
  return issues;
}

// ─── Report Compiler ────────────────────────────────────────────────────────

function compileOverviewReport(tempDir, date) {
  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    return { error: 'No result files found in temp directory' };
  }

  const issueResults = [];
  let generalResult = null;

  for (const file of files) {
    const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    if (meta.type === 'general') {
      generalResult = { meta, body };
    } else if (meta.type === 'issue') {
      issueResults.push({ meta, body, file });
    }
  }

  // Sort: activity first, then by update recency
  const withActivity = issueResults.filter(r => r.meta.has_activity === true);
  const noActivity = issueResults.filter(r => r.meta.has_activity !== true);

  // Count repos
  const repos = new Set(issueResults.map(r => `${r.meta.owner}/${r.meta.repo}`));

  // Build report
  let report = '';

  report += `## GitHub Issues Check-In — ${date}\n\n`;
  report += `**Tracking ${issueResults.length} active issues across ${repos.size} repos**`;

  // Find oldest check date for "last check"
  const checkDates = issueResults
    .map(r => r.meta.last_check_date)
    .filter(Boolean)
    .sort();
  if (checkDates.length > 0) {
    report += ` | Last check: ${checkDates[0]}`;
  }
  report += '\n\n---\n\n';

  // ── Issues with Activity ──
  if (withActivity.length > 0) {
    report += '### Issues with Activity\n\n';
    for (const r of withActivity) {
      report += buildIssueDetailBlock(r);
    }
  }

  // ── No Activity ──
  if (noActivity.length > 0) {
    report += '### No Activity\n\n';
    report += '| Issue | Last activity |\n';
    report += '|-------|---------------|\n';
    for (const r of noActivity) {
      const lastDate = r.meta.last_comment_date || r.meta.last_check_date || 'unknown';
      report += `| ${r.meta.owner}/${r.meta.repo}#${r.meta.number} — ${r.meta.title} | ${lastDate} |\n`;
    }
    report += '\n---\n\n';
  }

  // ── General Check Sections ──
  if (generalResult) {
    const body = generalResult.body;

    // New Issues
    const newIssuesSection = extractSection(body, 'New Issues');
    if (newIssuesSection && newIssuesSection.trim() !== 'None') {
      report += '### New Issues Not in Tracker\n\n';
      report += newIssuesSection + '\n\n---\n\n';
    } else {
      report += `### New Issues Not in Tracker\n\nNo new issues found since last check.\n\n---\n\n`;
    }

    // Reopened
    const reopenedSection = extractSection(body, 'Reopened');
    if (reopenedSection && reopenedSection.trim() !== 'None') {
      report += '### Reopened Issues\n\n';
      report += reopenedSection + '\n\n---\n\n';
    }

    // Closed Status
    const closedSection = extractSection(body, 'Closed Status');
    if (closedSection) {
      report += '### Closed Issues Status\n\n';
      report += closedSection + '\n\n---\n\n';
    }
  }

  // ── Upstream Status ──
  const upstreamResults = issueResults.filter(r => {
    const upstreamSection = extractSection(r.body, 'Upstream');
    return upstreamSection && upstreamSection.trim() !== 'N/A' && upstreamSection.trim() !== 'None';
  });
  if (upstreamResults.length > 0) {
    report += '### Upstream Status\n\n';
    report += '| Upstream issue | State | Impact |\n';
    report += '|----------------|-------|--------|\n';
    for (const r of upstreamResults) {
      const section = extractSection(r.body, 'Upstream');
      report += `| ${r.meta.owner}/${r.meta.repo}#${r.meta.number} | ${section.trim()} |\n`;
    }
    report += '\n---\n\n';
  }

  // ── Summary ──
  const actionItems = withActivity.reduce((count, r) => {
    const steps = extractSection(r.body, 'Next Steps');
    if (steps) count += (steps.match(/^- \[/gm) || []).length;
    return count;
  }, 0);

  report += '### Summary\n\n';
  report += `**Action items:** ${actionItems}\n`;
  if (withActivity.length > 0) {
    const needAttention = withActivity.slice(0, 3).map(
      r => `${r.meta.owner}/${r.meta.repo}#${r.meta.number}`
    );
    report += `**Issues needing attention:** ${needAttention.join(', ')}\n`;
  }
  if (noActivity.length > 0) {
    report += `**All quiet:** ${noActivity.length} issues with no activity\n`;
  }

  return { report, issue_count: issueResults.length, activity_count: withActivity.length };
}

function buildIssueDetailBlock(r) {
  let block = '';
  block += `#### ${r.meta.owner}/${r.meta.repo}#${r.meta.number} — ${r.meta.title}\n`;
  block += `| Field | Value |\n`;
  block += `|-------|-------|\n`;
  block += `| **State** | ${r.meta.state || 'Open'}${r.meta.state_changed ? ' [changed]' : ''} |\n`;
  if (r.meta.labels) {
    const labels = Array.isArray(r.meta.labels) ? r.meta.labels.join(', ') : r.meta.labels;
    block += `| **Labels** | ${labels} |\n`;
  }
  block += `| **Your role** | ${r.meta.role || 'Unknown'} |\n\n`;

  // Activity section
  const activity = extractSection(r.body, 'Activity');
  if (activity) {
    block += `**What happened:**\n${activity}\n\n`;
  }

  // Duplicates
  const dupes = extractSection(r.body, 'Known');
  const newFinds = extractSection(r.body, 'New finds');
  const hasDupes = dupes && !/^(none|no changes)\.?$/i.test(dupes.trim());
  const hasNewFinds = newFinds && !/^(none|none found|skipped)\.?/i.test(newFinds.trim());
  if (hasDupes || hasNewFinds) {
    block += `**Duplicates & related:**\n`;
    if (hasDupes) block += `- Known dupes — ${dupes.trim()}\n`;
    if (hasNewFinds) block += `- New finds — ${newFinds.trim()}\n`;
    block += '\n';
  }

  // Next Steps
  const steps = extractSection(r.body, 'Next Steps');
  if (steps) {
    block += `**Next steps:**\n${steps}\n\n`;
  }

  // Watch For
  const watch = extractSection(r.body, 'Watch For');
  if (watch) {
    block += `**Watch for:**\n${watch}\n\n`;
  }

  block += '---\n\n';
  return block;
}

function extractSection(body, headerPattern) {
  // Match ## Header or ### Header, capture until next ## or end
  const re = new RegExp(
    `^#{2,4}\\s+(?:[^\\n]*?${headerPattern}[^\\n]*)\\n([\\s\\S]*?)(?=^#{2,4}\\s|$)`,
    'mi'
  );
  const match = body.match(re);
  return match ? match[1].trim() : null;
}

// ─── Tracker Updater ────────────────────────────────────────────────────────

function applyTrackerUpdates(trackerContent, tempDir, date) {
  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.md'));
  let updated = trackerContent;
  const changes = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    if (meta.type !== 'issue') continue;

    const issueKey = `${meta.owner}/${meta.repo}#${meta.number}`;

    // Find this issue's section in the tracker
    const sectionRe = new RegExp(
      `(### ${escapeRegex(meta.owner)}/${escapeRegex(meta.repo)}#${meta.number}\\s*[—–-][^\\n]*\\n[\\s\\S]*?)(?=\\n### |\\n## |$)`,
      'm'
    );
    const sectionMatch = updated.match(sectionRe);
    if (!sectionMatch) continue;

    let section = sectionMatch[1];
    const originalSection = section;

    // Update "Status as of" date and summary
    const trackerUpdates = extractSection(body, 'Tracker Updates');
    if (trackerUpdates) {
      const statusLine = trackerUpdates.match(/^status_summary:\s*(.+)/m);
      if (statusLine) {
        section = section.replace(
          /\*\*Status as of \d{4}-\d{2}-\d{2}\*\*:\s*.+/,
          `**Status as of ${date}:** ${statusLine[1].trim()}`
        );
      }

      const watchLine = trackerUpdates.match(/^what_to_check:\s*(.+)/m);
      if (watchLine) {
        section = section.replace(
          /\*\*What to check\*\*:\s*.+/,
          `**What to check:** ${watchLine[1].trim()}`
        );
      }
    }

    // Handle state change: open → closed (move to Closed section)
    if (meta.state === 'closed' && meta.state_changed) {
      // Remove from active
      updated = updated.replace(originalSection, '');
      // Add to closed
      const closedEntry = `### ${issueKey} — ${meta.title}\n- Closed as of ${date}. ${meta.close_reason || ''}\n\n`;
      updated = updated.replace(
        /(## Closed[^\n]*\n)/,
        `$1\n${closedEntry}`
      );
      changes.push(`Moved ${issueKey} to Closed`);
      continue;
    }

    // Add new duplicates
    if (trackerUpdates) {
      const newDupeLines = [];
      const dupeRe = /new_duplicate:\s*#?(\d+)\s*[—–-]\s*(.+)/gm;
      let dupeMatch;
      while ((dupeMatch = dupeRe.exec(trackerUpdates)) !== null) {
        newDupeLines.push(`  - **#${dupeMatch[1]}** — ${dupeMatch[2].trim()}`);
      }
      if (newDupeLines.length > 0) {
        const dupeHeader = `**Duplicates found (${date}):**`;
        if (section.includes('Duplicates found')) {
          // Append to existing duplicates section
          section = section.replace(
            /(Duplicates found[^*]*\*\*:?\s*\n(?:\s+-[^\n]*\n)*)/,
            `$1${dupeHeader}\n${newDupeLines.join('\n')}\n`
          );
        } else {
          // Add before Next steps
          section = section.replace(
            /(\*\*Next steps)/,
            `- ${dupeHeader}\n${newDupeLines.join('\n')}\n- $1`
          );
        }
        changes.push(`Added ${newDupeLines.length} duplicates to ${issueKey}`);
      }
    }

    if (section !== originalSection) {
      updated = updated.replace(originalSection, section);
      changes.push(`Updated ${issueKey}`);
    }
  }

  // Handle new issues from general check
  const generalFile = files.find(f => f.startsWith('general'));
  if (generalFile) {
    const content = fs.readFileSync(path.join(tempDir, generalFile), 'utf8');
    const { body } = parseFrontmatter(content);
    const newIssues = extractSection(body, 'New Issues to Add');
    if (newIssues) {
      // Append raw entries before the Closed section
      updated = updated.replace(
        /(## Closed)/,
        `${newIssues.trim()}\n\n$1`
      );
      changes.push('Added new issues to tracker');
    }
  }

  return { content: updated, changes };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Command Implementations ────────────────────────────────────────────────

function cmdParseTracker(flags) {
  const filePath = flags._positional || flags.tracker;
  if (!filePath) {
    console.error('Usage: parse-tracker <path-to-tracker>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({ exists: false, error: 'Tracker file not found' }));
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    console.log(JSON.stringify({ exists: true, empty: true }));
    return;
  }

  const parsed = parseTrackerFile(content);
  console.log(JSON.stringify({
    exists: true,
    empty: false,
    username: parsed.username,
    active_count: parsed.active_issues.length,
    closed_count: parsed.closed_issues.length,
    active_issues: parsed.active_issues,
    closed_issues: parsed.closed_issues,
    all_tracked_numbers: [
      ...parsed.active_issues.map(i => `${i.owner}/${i.repo}#${i.number}`),
      ...parsed.closed_issues.map(i => `${i.owner}/${i.repo}#${i.number}`),
    ],
    oldest_check_date: parsed.active_issues
      .map(i => i.last_check_date)
      .filter(Boolean)
      .sort()[0] || null,
  }, null, 2));
}

function cmdCompileReport(flags) {
  const tempDir = flags['temp-dir'];
  const date = flags.date;

  if (!tempDir || !date) {
    console.error('Usage: compile-report --temp-dir <dir> --date <YYYY-MM-DD>');
    process.exit(1);
  }

  if (!fs.existsSync(tempDir)) {
    console.error(`Temp directory not found: ${tempDir}`);
    process.exit(1);
  }

  const result = compileOverviewReport(tempDir, date);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  // Write report to temp dir as well for validation
  fs.writeFileSync(path.join(tempDir, '_compiled-report.md'), result.report, 'utf8');

  // Output the report to stdout
  console.log(result.report);

  // Write metadata to stderr for the agent to parse
  console.error(JSON.stringify({
    issue_count: result.issue_count,
    activity_count: result.activity_count,
    report_file: path.join(tempDir, '_compiled-report.md'),
  }));
}

function cmdUpdateTracker(flags) {
  const trackerPath = flags.tracker;
  const tempDir = flags['temp-dir'];
  const date = flags.date;

  if (!trackerPath || !tempDir || !date) {
    console.error('Usage: update-tracker --tracker <path> --temp-dir <dir> --date <YYYY-MM-DD>');
    process.exit(1);
  }

  if (!fs.existsSync(trackerPath)) {
    console.error(`Tracker file not found: ${trackerPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(trackerPath, 'utf8');
  const { content: updated, changes } = applyTrackerUpdates(content, tempDir, date);

  if (changes.length === 0) {
    console.log(JSON.stringify({ updated: false, changes: [] }));
    return;
  }

  fs.writeFileSync(trackerPath, updated, 'utf8');
  console.log(JSON.stringify({ updated: true, changes }));
}

function cmdInitTemp(flags) {
  const prefix = 'giu-checkin-';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  console.log(tempDir);
}

function cmdValidate(flags) {
  const tempDir = flags['temp-dir'];
  const trackerPath = flags.tracker;
  const expected = parseInt(flags.expected || '0', 10);

  if (!tempDir) {
    console.error('Usage: validate --temp-dir <dir> [--tracker <path>] [--expected <N>]');
    process.exit(1);
  }

  const checks = {
    temp_dir_exists: fs.existsSync(tempDir),
    result_files: [],
    report_compiled: false,
    tracker_valid: null,
    all_issues_checked: null,
  };

  if (checks.temp_dir_exists) {
    const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.md'));
    checks.result_files = files;
    checks.report_compiled = files.includes('_compiled-report.md');

    const issueFiles = files.filter(f => f.startsWith('issue-'));
    checks.all_issues_checked = expected > 0
      ? issueFiles.length >= expected
      : issueFiles.length > 0;
  }

  if (trackerPath && fs.existsSync(trackerPath)) {
    const content = fs.readFileSync(trackerPath, 'utf8');
    const today = flags.date || new Date().toISOString().split('T')[0];
    checks.tracker_valid = content.includes(`Status as of ${today}`);
  }

  const passed = checks.temp_dir_exists
    && checks.report_compiled
    && checks.all_issues_checked !== false;

  console.log(JSON.stringify({ passed, checks }, null, 2));
}
