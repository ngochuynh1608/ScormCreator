import { ProjectEditor } from "@/components/ProjectEditor";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return <ProjectEditor projectId={id} />;
}
