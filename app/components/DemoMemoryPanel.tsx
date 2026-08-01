import type { DemoMemoryFilter, DemoRoom } from "./HomeCampusDemo";

type DemoMemoryPanelProps = {
  room: DemoRoom;
  filter: DemoMemoryFilter;
  onFilterChange: (filter: DemoMemoryFilter) => void;
};

const filters: Array<{ id: DemoMemoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "photo", label: "Photos" },
  { id: "story", label: "Stories" },
];

function formatType(type: "photo" | "story" | "event") {
  return type === "photo" ? "Photo" : type === "story" ? "Story" : "Event";
}

export default function DemoMemoryPanel({ room, filter, onFilterChange }: DemoMemoryPanelProps) {
  const memories = filter === "all" ? room.memories : room.memories.filter((memory) => memory.type === filter);

  return (
    <aside className="mm-demo-panel" aria-label={`${room.name} memories`}>
      <div className="mm-demo-panel__heading"><div><span className="mm-demo-label">Selected room</span><h3>{room.name}</h3></div><span className="mm-demo-panel__count">{room.memoryCount} memories</span></div>
      <div className="mm-demo-tabs" role="tablist" aria-label="Filter memories">
        {filters.map((item) => <button type="button" key={item.id} className={filter === item.id ? "is-active" : ""} role="tab" aria-selected={filter === item.id} onClick={() => onFilterChange(item.id)}>{item.label}</button>)}
      </div>
      <div className="mm-demo-memory-list" key={`${room.id}-${filter}`}>
        {memories.length > 0 ? memories.map((memory) => <article className="mm-demo-memory" key={memory.id}><div className="mm-demo-memory__meta"><time dateTime="2026-07-16">{memory.date}</time><span>{formatType(memory.type)}</span></div><h4>{memory.title}</h4><p>{memory.description}</p><footer>{memory.reactions} reactions <span>·</span> {memory.comments} comments</footer></article>) : <p className="mm-demo-empty">No {filter === "photo" ? "photo" : "story"} memories here yet.</p>}
      </div>
      <button type="button" className="mm-demo-panel__footer">Open room archive <span aria-hidden="true">↗</span></button>
    </aside>
  );
}
