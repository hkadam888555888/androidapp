import type {
  ID,
  NormalizedRoadmapNode,
  ParsedRoadmap,
  ParseMarker,
  RoadmapNodeType,
  RoadmapParseIssue,
} from '../entities/models';

interface LineInfo {
  raw: string;
  lineNumber: number;
  cleaned: string;
  depth: number;
  marker: ParseMarker;
  numbering?: string;
  explicitDepth: boolean;
}

const TREE_MARKER = /^(?:(?:│|\|)\s*)*(?:├──|└──|├─|└─|─>\s*)/u;
const NUMBER_MARKER = /^(\d+(?:\.\d+)*)[.)]?\s+(.*)$/u;
const BULLET_MARKER = /^[-*+]\s+(.*)$/u;
const HEADING_MARKER = /^(#{1,6})\s+(.*)$/u;

export function parseRoadmap(sourceText: string, roadmapId: ID = 'roadmap-import'): ParsedRoadmap {
  const lines = sourceText.replace(/\r\n?/g, '\n').split('\n');
  const issues: RoadmapParseIssue[] = [];
  const infos: LineInfo[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    infos.push(parseLine(lines[i], i + 1, issues));
  }

  const nodes: NormalizedRoadmapNode[] = [];
  let previousDepth = 0;
  let hasPrevious = false;
  const stack: Array<{ depth: number; id: ID }> = [];
  const siblingTitlesByParent = new Map<string, Set<string>>();

  for (const info of infos) {
    if (!info.cleaned) continue;

    const depth = Math.max(0, info.depth);
    if (hasPrevious && depth > previousDepth + 1) {
      issues.push({ lineNumber: info.lineNumber, code: 'impossible_indent', message: `Indentation jumped from depth ${previousDepth} to ${depth}.` });
    }
    if (depth > 0 && stack.length === 0) {
      issues.push({ lineNumber: info.lineNumber, code: 'orphaned_child', message: 'Indented node has no parent.' });
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
    const parentId = stack.at(-1)?.id;

    const siblingKey = parentId ?? 'ROOT';
    const siblingSet = siblingTitlesByParent.get(siblingKey) ?? new Set<string>();
    const titleKey = info.cleaned.toLocaleLowerCase();
    if (siblingSet.has(titleKey)) {
      issues.push({ lineNumber: info.lineNumber, code: 'duplicate_sibling', message: `Duplicate sibling title: ${info.cleaned}` });
    }
    siblingSet.add(titleKey);
    siblingTitlesByParent.set(siblingKey, siblingSet);

    const id = `${roadmapId}:node:${nodes.length + 1}`;
    const node: NormalizedRoadmapNode = {
      id,
      roadmapId,
      rawLine: info.raw,
      cleanedTitle: info.cleaned,
      depth,
      orderIndex: nodes.length,
      parentId,
      numbering: info.numbering,
      marker: info.marker,
      nodeType: classifyNode(depth, info.marker, info.cleaned),
      confidence: info.explicitDepth || info.marker === 'heading' || info.marker === 'tree' ? 'high' : 'medium',
      userApproved: false,
    };
    nodes.push(node);
    previousDepth = depth;
    hasPrevious = true;
    stack.push({ depth, id });
  }

  return { roadmapId, sourceText, nodes, issues };
}

function parseLine(raw: string, lineNumber: number, issues: RoadmapParseIssue[]): LineInfo {
  const expanded = raw.replace(/\t/g, '    ');
  const leadingSpaces = expanded.match(/^\s*/u)?.[0].length ?? 0;
  const trimmed = expanded.trim();
  if (!trimmed) return { raw, lineNumber, cleaned: '', depth: 0, marker: 'plain', explicitDepth: true };

  const heading = trimmed.match(HEADING_MARKER);
  if (heading) {
    return { raw, lineNumber, cleaned: heading[2].trim(), depth: heading[1].length - 1, marker: 'heading', explicitDepth: true };
  }

  const tree = trimmed.match(TREE_MARKER);
  if (tree) {
    const prefix = expanded.match(/^\s*[│| ]*/u)?.[0] ?? '';
    const treePrefixColumns = prefix.replace(/[^ │|]/gu, '').length;
    const depth = treePrefixColumns === 0 ? 0 : Math.floor(treePrefixColumns / 4);
    return { raw, lineNumber, cleaned: trimmed.replace(TREE_MARKER, '').trim(), depth, marker: 'tree', explicitDepth: true };
  }

  const numbered = trimmed.match(NUMBER_MARKER);
  if (numbered) {
    const numbering = numbered[1];
    const numericDepth = numbering.split('.').length - 1;
    return {
      raw,
      lineNumber,
      cleaned: numbered[2].trim(),
      depth: leadingSpaces > 0 ? Math.floor(leadingSpaces / 2) : numericDepth,
      marker: 'numbered',
      numbering,
      explicitDepth: leadingSpaces > 0 || numericDepth > 0,
    };
  }

  const bullet = trimmed.match(BULLET_MARKER);
  if (bullet) {
    return {
      raw,
      lineNumber,
      cleaned: bullet[1].trim(),
      depth: Math.floor(leadingSpaces / 2),
      marker: 'bullet',
      explicitDepth: leadingSpaces > 0,
    };
  }

  if (/^\d+(?:\.\d+)+\s*$/u.test(trimmed)) {
    issues.push({ lineNumber, code: 'malformed_numbering', message: 'Numbered item has no title.' });
  }

  return {
    raw,
    lineNumber,
    cleaned: trimmed,
    depth: Math.floor(leadingSpaces / 2),
    marker: 'plain',
    explicitDepth: leadingSpaces > 0,
  };
}

function classifyNode(depth: number, marker: ParseMarker, title: string): RoadmapNodeType {
  const normalized = title.toLocaleLowerCase();
  if (/project|capstone|build/i.test(normalized)) return 'project';
  if (/milestone|checkpoint|goal/i.test(normalized)) return 'milestone';
  if (/review|revision/i.test(normalized)) return 'review_area';
  if (depth === 0) return marker === 'heading' ? 'subject' : 'module';
  if (depth === 1) return 'module';
  if (/practice|exercise|skill/i.test(normalized)) return 'skill';
  return 'concept';
}
