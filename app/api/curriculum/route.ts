import { NextResponse } from "next/server";
import { getSubjectCounts } from "@/lib/clue-db";
import { findTopic, loadTopicTree } from "@/lib/topic-tree";

/**
 * The curriculum view's spine: every subject with its full clue count
 * (clue-level subjects, so wordplay/misc rescues are included). misc and
 * potpourri fold into one "Unclassified" bucket.
 */
export async function GET() {
  try {
    const tree = await loadTopicTree();
    const counts = getSubjectCounts();

    let unclassified = 0;
    const subjects: Array<{ id: string; title: string; clueCount: number }> = [];
    for (const row of counts) {
      if (!row.subject_id || row.subject_id === "misc" || row.subject_id === "potpourri") {
        unclassified += row.n;
        continue;
      }
      const topic = findTopic(tree, row.subject_id);
      subjects.push({
        id: row.subject_id,
        title: topic?.title ?? row.subject_id,
        clueCount: row.n,
      });
    }
    subjects.sort((a, b) => b.clueCount - a.clueCount);

    return NextResponse.json(
      { subjects, unclassified },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load the curriculum." },
      { status: 500 },
    );
  }
}
