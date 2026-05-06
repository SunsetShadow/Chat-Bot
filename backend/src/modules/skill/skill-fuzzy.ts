import { Skill } from './skill.types';

interface FuzzyCandidate {
  skill: Skill;
  score: number;
  matchType: string;
}

/** Levenshtein 编辑距离 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** 模糊匹配引擎：多策略链式匹配 */
export function fuzzyMatch(query: string, skills: Skill[]): FuzzyCandidate[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const candidates: FuzzyCandidate[] = [];

  for (const skill of skills) {
    const name = skill.name.toLowerCase();
    const desc = skill.description.toLowerCase();
    const aliases = (skill.aliases || []).map(a => a.toLowerCase());

    // Strategy 1: Alias exact match (score: 100)
    if (aliases.some(a => a === q)) {
      candidates.push({ skill, score: 100, matchType: 'alias' });
      continue;
    }

    // Strategy 2: Keyword subset match (score: 80)
    const qParts = q.split(/[-_\s]+/);
    const nameParts = name.split(/[-_\s]+/);
    const allParts = [...nameParts, ...aliases];
    const matchCount = qParts.filter(qp =>
      allParts.some(ap => ap.includes(qp) || qp.includes(ap)),
    ).length;
    if (matchCount === qParts.length && qParts.length > 0) {
      candidates.push({ skill, score: 80 + matchCount * 5, matchType: 'keyword' });
      continue;
    }

    // Strategy 3: Edit distance tolerance (<= 2) (score: 60)
    if (name.length >= 2) {
      const dist = editDistance(q, name);
      if (dist <= 2 && dist < name.length * 0.4) {
        candidates.push({ skill, score: 60 - dist * 10, matchType: 'edit_distance' });
        continue;
      }
      // Also check aliases
      for (const alias of aliases) {
        const aliasDist = editDistance(q, alias);
        if (aliasDist <= 2 && aliasDist < alias.length * 0.4) {
          candidates.push({ skill, score: 55 - aliasDist * 10, matchType: 'alias_edit_distance' });
          break;
        }
      }
    }

    // Strategy 4: Description keyword overlap (score: 40)
    const descWords = desc.split(/\s+/);
    const overlap = qParts.filter(qp =>
      descWords.some(dw => dw.includes(qp)),
    ).length;
    if (overlap >= Math.ceil(qParts.length * 0.5) && overlap > 0) {
      candidates.push({ skill, score: 40 + overlap * 5, matchType: 'description' });
    }
  }

  // Deduplicate (keep highest score per skill) and sort
  const best = new Map<string, FuzzyCandidate>();
  for (const c of candidates) {
    const existing = best.get(c.skill.id);
    if (!existing || c.score > existing.score) {
      best.set(c.skill.id, c);
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
