import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DashboardNodeLibraryAssetItem } from "~/app/_nodes/node-library-asset-item/node";
import { DashboardNodeLibraryView } from "~/app/_nodes/node-library-view/node";
import { DashboardNodeText } from "~/app/_nodes/node-text/node";

type NodeProps = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
};

function titleFromType(type: string) {
  return type
    .replace(/^node-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function DefaultNodeCard({ id, type, props }: NodeProps) {
  return (
    <Card className="h-full border-zinc-800 bg-zinc-900/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-wide text-zinc-100">
          {titleFromType(type)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-zinc-300">
        <p className="text-zinc-400">node id: {id}</p>
        {props && Object.keys(props).length > 0 ? (
          <pre className="max-h-40 overflow-auto rounded bg-black/40 p-2">
            {JSON.stringify(props, null, 2)}
          </pre>
        ) : (
          <p className="text-zinc-500">No props configured.</p>
        )}
      </CardContent>
    </Card>
  );
}

export const ComponentRegistry: Record<string, React.ComponentType<NodeProps>> = new Proxy(
  {
    "node-library-asset-item": ({ props }) => (
      <DashboardNodeLibraryAssetItem props={props} />
    ),
    "library-asset-item": ({ props }) => (
      <DashboardNodeLibraryAssetItem props={props} />
    ),
    "node-library_view": ({ props }) => <DashboardNodeLibraryView props={props} />,
    library_view: ({ props }) => <DashboardNodeLibraryView props={props} />,
    "node-text": ({ props }) => <DashboardNodeText props={props} />,
    text: ({ props }) => <DashboardNodeText props={props} />,
  },
  {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      const existing = (_target as Record<string, React.ComponentType<NodeProps>>)[prop];
      if (existing) return existing;
      return (nodeProps: NodeProps) => <DefaultNodeCard {...nodeProps} />;
    },
  },
) as Record<string, React.ComponentType<NodeProps>>;
