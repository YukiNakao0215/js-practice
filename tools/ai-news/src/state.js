import fs from 'node:fs';
import path from 'node:path';

/**
 * 既出記事の記録。
 * これが無いと、前日と同じ記事が毎日ノートに並ぶ（RSSは数日分を返し続けるため）。
 */
export function loadState(statePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (parsed && typeof parsed.seen === 'object' && parsed.seen !== null) {
      return { seen: parsed.seen };
    }
  } catch {
    // 未作成 or 壊れている場合は空から始める（初回実行がこれ）
  }
  return { seen: {} };
}

/**
 * 既出判定を作る。
 * exceptDate（通常は実行日）に記録した分は既出扱いしない。
 * これが無いと --force での再生成が「0件のノート」で既存ノートを潰す。
 */
export function isSeenIn(state, exceptDate = null) {
  return (key) => Object.hasOwn(state.seen, key) && state.seen[key] !== exceptDate;
}

/** 今回採用した記事を記録し、保持期間を過ぎたものを捨てる */
export function updateState(state, articles, dateString, retentionDays) {
  for (const article of articles) {
    for (const key of article.keys) state.seen[key] = dateString;
  }

  const cutoff = new Date(`${dateString}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffString = cutoff.toISOString().slice(0, 10);

  for (const [key, seenDate] of Object.entries(state.seen)) {
    if (typeof seenDate !== 'string' || seenDate < cutoffString) delete state.seen[key];
  }
  return state;
}

/** 書き込み途中で落ちても状態を壊さないよう、一時ファイル経由で置き換える */
export function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tempPath = `${statePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify({ version: 1, ...state }, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, statePath);
}
