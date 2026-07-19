import { NextResponse } from "next/server";
import { getCanonAnswers, getTopCategoriesForSubject } from "@/lib/clue-db";
import { findTopic, loadTopicTree, type TreeTopic } from "@/lib/topic-tree";

/** Study units inside one subject: canon answers, top categories, subtopics. */
export async function GET(
  _request: Request,
  { params }: { params: { subject: string } | Promise<{ subject: string }> },
) {
  try {
    const { subject } = await Promise.resolve(params);
    const tree = await loadTopicTree();
    const topic = findTopic(tree, subject);
    if (!topic) {
      return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    }

    const subtopics = (topic.children ?? [])
      .filter((child: TreeTopic) => child.id.startsWith("sub:"))
      .map((child: TreeTopic) => ({
        id: child.id,
        title: child.title,
      }));

    return NextResponse.json(
      {
        id: subject,
        title: topic.title,
        topAnswers: getCanonAnswers(subject, 25),
        topCategories: getTopCategoriesForSubject(subject, 12),
        subtopics,
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load subject details." },
      { status: 500 },
    );
  }
}
