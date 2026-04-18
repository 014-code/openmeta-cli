import chalk from 'chalk';
import { getUiCapabilities } from './capabilities.js';
import { padLine, visibleLength, wrapLine, wrapLines } from './layout.js';
import { runTask } from './live.js';
import type {
  CardOptions,
  KeyValueItem,
  MetricItem,
  RecordItem,
  StepItem,
  StepState,
  TaskOptions,
  TimelineItem,
  Tone,
  UiCapabilities,
} from './types.js';

interface BoxChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

function boxChars(capabilities: UiCapabilities): BoxChars {
  if (capabilities.supportsUnicode) {
    return {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    };
  }

  return {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
  };
}

function toneColor(tone: Tone): (text: string) => string {
  switch (tone) {
    case 'success':
      return chalk.greenBright;
    case 'warning':
      return chalk.yellowBright;
    case 'error':
      return chalk.redBright;
    case 'muted':
      return chalk.gray;
    case 'accent':
      return chalk.magentaBright;
    case 'info':
    default:
      return chalk.cyanBright;
  }
}

function toneAccent(tone: Tone): (text: string) => string {
  switch (tone) {
    case 'success':
      return chalk.green;
    case 'warning':
      return chalk.yellow;
    case 'error':
      return chalk.red;
    case 'muted':
      return chalk.gray;
    case 'accent':
      return chalk.magenta;
    case 'info':
    default:
      return chalk.cyan;
  }
}

function statusSymbol(state: StepState): string {
  switch (state) {
    case 'done':
      return '[ok]';
    case 'active':
      return '[>]';
    case 'error':
      return '[x]';
    case 'pending':
    default:
      return '[ ]';
  }
}

function statusColor(state: StepState): (text: string) => string {
  switch (state) {
    case 'done':
      return chalk.greenBright;
    case 'active':
      return chalk.cyanBright;
    case 'error':
      return chalk.redBright;
    case 'pending':
    default:
      return chalk.gray;
  }
}

function printBlankLine(): void {
  process.stdout.write('\n');
}

function printCard(capabilities: UiCapabilities, options: CardOptions): void {
  const chars = boxChars(capabilities);
  const width = Math.max(52, Math.min(capabilities.width - 2, 106));
  const innerWidth = width - 4;
  const color = toneColor(options.tone ?? 'info');
  const accent = toneAccent(options.tone ?? 'info');

  const content = [
    ...(options.label ? [accent(options.label.toUpperCase())] : []),
    chalk.bold(options.title),
    ...(options.subtitle ? wrapLine(options.subtitle, innerWidth).map((line) => chalk.gray(line)) : []),
    ...(options.lines ? wrapLines(options.lines, innerWidth) : []),
  ];

  const top = `${chars.topLeft}${chars.horizontal.repeat(width - 2)}${chars.topRight}`;
  const bottom = `${chars.bottomLeft}${chars.horizontal.repeat(width - 2)}${chars.bottomRight}`;

  printBlankLine();
  process.stdout.write(`${color(top)}\n`);
  for (const line of content) {
    process.stdout.write(`${color(chars.vertical)} ${padLine(line, innerWidth)} ${color(chars.vertical)}\n`);
  }
  process.stdout.write(`${color(bottom)}\n`);
}

function printSection(capabilities: UiCapabilities, title: string, subtitle?: string): void {
  const width = Math.max(44, Math.min(capabilities.width - 2, 106));
  const rule = '-'.repeat(Math.max(12, width - visibleLength(title) - 3));
  printBlankLine();
  process.stdout.write(`${chalk.cyanBright(title)} ${chalk.gray(rule)}\n`);
  if (subtitle) {
    for (const line of wrapLine(subtitle, width)) {
      process.stdout.write(`${chalk.gray(line)}\n`);
    }
  }
}

function printList(lines: string[], tone: Tone = 'muted'): void {
  const color = toneColor(tone);
  for (const line of lines) {
    process.stdout.write(`${color('-')} ${chalk.gray(line)}\n`);
  }
}

function printKeyValues(capabilities: UiCapabilities, title: string, items: KeyValueItem[]): void {
  const width = Math.max(44, Math.min(capabilities.width - 2, 106));
  const labelWidth = Math.min(22, Math.max(...items.map((item) => item.label.length), 10));
  printSection(capabilities, title);

  for (const item of items) {
    const label = chalk.gray(item.label.padEnd(labelWidth));
    const valueColor = toneColor(item.tone ?? 'info');
    const available = Math.max(20, width - labelWidth - 3);
    const wrapped = wrapLine(item.value, available);

    wrapped.forEach((line, index) => {
      const renderedLabel = index === 0 ? label : ' '.repeat(labelWidth);
      process.stdout.write(`  ${renderedLabel} ${valueColor(line)}\n`);
    });
  }
}

function printStats(capabilities: UiCapabilities, title: string, items: MetricItem[]): void {
  printSection(capabilities, title);
  const columns = capabilities.mode === 'interactive-rich' && capabilities.width >= 96 ? 3 : 2;
  const width = Math.max(44, Math.min(capabilities.width - 2, 106));
  const cardWidth = Math.max(18, Math.floor((width - ((columns - 1) * 3)) / columns));
  const rows: string[][] = [];

  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns).map((item) => {
      const value = toneColor(item.tone ?? 'accent')(chalk.bold(item.value));
      const hint = item.hint ? chalk.gray(` ${item.hint}`) : '';
      const line = `${value}${hint}`;
      const label = chalk.gray(item.label);
      const combined = `${line}\n${label}`;
      return combined;
    }));
  }

  for (const row of rows) {
    const firstLine = row.map((entry) => {
      const [value] = entry.split('\n');
      return padLine(value || '', cardWidth);
    }).join('   ');
    const secondLine = row.map((entry) => {
      const [, label] = entry.split('\n');
      return padLine(label || '', cardWidth);
    }).join('   ');
    process.stdout.write(`  ${firstLine}\n`);
    process.stdout.write(`  ${secondLine}\n`);
  }
}

function printStepper(capabilities: UiCapabilities, title: string, steps: StepItem[]): void {
  printSection(capabilities, title);

  for (const [index, step] of steps.entries()) {
    const color = statusColor(step.state);
    const symbol = color(statusSymbol(step.state));
    const prefix = chalk.gray(`${String(index + 1).padStart(2, '0')}.`);
    process.stdout.write(`  ${prefix} ${symbol} ${chalk.white(step.label)}\n`);
    if (step.description) {
      for (const line of wrapLine(step.description, Math.max(36, capabilities.width - 12))) {
        process.stdout.write(`      ${chalk.gray(line)}\n`);
      }
    }
  }
}

function printTimeline(capabilities: UiCapabilities, title: string, items: TimelineItem[]): void {
  printSection(capabilities, title);

  for (const item of items) {
    const color = statusColor(item.state);
    process.stdout.write(`  ${color(statusSymbol(item.state))} ${chalk.white(item.title)}${item.meta ? chalk.gray(`  ${item.meta}`) : ''}\n`);
    if (item.subtitle) {
      for (const line of wrapLine(item.subtitle, Math.max(36, capabilities.width - 10))) {
        process.stdout.write(`      ${chalk.gray(line)}\n`);
      }
    }
  }
}

function printRecordList(capabilities: UiCapabilities, title: string, items: RecordItem[]): void {
  printSection(capabilities, title);

  for (const item of items) {
    const accent = toneColor(item.tone ?? 'info');
    process.stdout.write(`  ${accent('*')} ${accent(item.title)}\n`);
    if (item.subtitle) {
      for (const line of wrapLine(item.subtitle, Math.max(36, capabilities.width - 10))) {
        process.stdout.write(`      ${chalk.gray(line)}\n`);
      }
    }
    if (item.meta && item.meta.length > 0) {
      process.stdout.write(`      ${chalk.gray(item.meta.join(' | '))}\n`);
    }
    if (item.lines) {
      for (const line of item.lines) {
        process.stdout.write(`      ${line}\n`);
      }
    }
  }
}

function makeBadge(label: string, tone: Tone = 'info'): string {
  return toneColor(tone)(`[${label}]`);
}

function maskSecret(secret?: string): string {
  if (!secret) {
    return '(not set)';
  }

  if (secret.length <= 4) {
    return '****';
  }

  return `***${secret.slice(-4)}`;
}

const capabilities = getUiCapabilities();

export const ui = {
  banner(options: CardOptions): void {
    printCard(capabilities, options);
  },

  hero(options: CardOptions): void {
    printCard(capabilities, {
      ...options,
      tone: options.tone ?? 'accent',
    });
  },

  card(options: CardOptions): void {
    printCard(capabilities, options);
  },

  callout(options: CardOptions): void {
    printCard(capabilities, options);
  },

  section(title: string, subtitle?: string): void {
    printSection(capabilities, title, subtitle);
  },

  list(lines: string[], tone: Tone = 'muted'): void {
    printList(lines, tone);
  },

  keyValues(title: string, items: KeyValueItem[]): void {
    printKeyValues(capabilities, title, items);
  },

  stats(title: string, items: MetricItem[]): void {
    printStats(capabilities, title, items);
  },

  stepper(title: string, steps: StepItem[]): void {
    printStepper(capabilities, title, steps);
  },

  timeline(title: string, items: TimelineItem[]): void {
    printTimeline(capabilities, title, items);
  },

  recordList(title: string, items: RecordItem[]): void {
    printRecordList(capabilities, title, items);
  },

  badge(label: string, tone: Tone = 'info'): string {
    return makeBadge(label, tone);
  },

  maskSecret(secret?: string): string {
    return maskSecret(secret);
  },

  async task<T>(options: TaskOptions, task: () => Promise<T>): Promise<T> {
    return runTask(capabilities, options, task);
  },

  commandCancelled(commandName: string): void {
    printCard(capabilities, {
      label: commandName,
      title: 'Session closed',
      subtitle: 'No changes were made because the flow was cancelled by the user.',
      tone: 'warning',
    });
  },

  commandFailed(commandName: string, message: string): void {
    printCard(capabilities, {
      label: commandName,
      title: 'Command failed',
      subtitle: message,
      tone: 'error',
    });
  },

  emptyState(commandName: string, title: string, subtitle: string): void {
    printCard(capabilities, {
      label: commandName,
      title,
      subtitle,
      tone: 'warning',
    });
  },
};

export type {
  CardOptions,
  KeyValueItem,
  MetricItem,
  RecordItem,
  StepItem,
  StepState,
  TaskOptions,
  TimelineItem,
  Tone,
} from './types.js';
