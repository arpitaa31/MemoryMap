import type { DemoRoom } from "./HomeCampusDemo";

type DemoRoomCardProps = {
  room: DemoRoom;
  selected: boolean;
  onSelect: (roomId: string) => void;
};

export default function DemoRoomCard({ room, selected, onSelect }: DemoRoomCardProps) {
  return (
    <button
      type="button"
      className={`mm-demo-room mm-demo-room--${room.accent}${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(room.id)}
      aria-label={`${room.name}, ${room.memoryCount} memories`}
      aria-pressed={selected}
    >
      <span className="mm-demo-room__topline"><span className="mm-demo-room__number">{room.roomNumber}</span><span className="mm-demo-room__count">{room.memoryCount}</span></span>
      <strong>{room.name}</strong>
      <span className="mm-demo-room__meta">{room.memoryCount} memories</span>
      {selected && <span className="mm-demo-room__active" aria-hidden="true" />}
    </button>
  );
}
