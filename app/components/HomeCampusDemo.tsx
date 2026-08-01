"use client";

import { useMemo, useState } from "react";
import MemoryMapLogo from "./MemoryMapLogo";
import DemoMemoryPanel from "./DemoMemoryPanel";
import DemoRoomCard from "./DemoRoomCard";

export type DemoMemoryFilter = "all" | "photo" | "story";

export type DemoMemory = {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "photo" | "story" | "event";
  reactions: number;
  comments: number;
};

export type DemoRoom = {
  id: string;
  name: string;
  roomNumber: string;
  memoryCount: number;
  accent: "neutral" | "moss" | "terracotta" | "ochre" | "teal" | "rust";
  memories: DemoMemory[];
};

export type DemoArea = {
  id: string;
  name: string;
  rooms: DemoRoom[];
};

const memory = (id: string, title: string, description: string, date: string, type: DemoMemory["type"], reactions: number, comments: number): DemoMemory => ({ id, title, description, date, type, reactions, comments });

const demoAreas: DemoArea[] = [
  {
    id: "ground-floor",
    name: "Ground Floor",
    rooms: [
      { id: "chemistry-lab", name: "Chemistry Lab", roomNumber: "G-04", memoryCount: 72, accent: "terracotta", memories: [memory("test-tube", "The test tube incident", "Churu broke another test tube. We still laugh about how calmly he carried on.", "16 July 2026", "story", 8, 4), memory("salt-analysis", "Salt analysis confusion", "Nobody agreed on the colour change, so we compared notes under the table.", "04 March 2026", "event", 5, 2), memory("last-practical", "Last practical before summer break", "One last experiment, then everyone escaped to the courtyard.", "28 February 2026", "photo", 11, 3)] },
      { id: "physics-lab", name: "Physics Lab", roomNumber: "G-05", memoryCount: 48, accent: "neutral", memories: [memory("pendulum", "The pendulum would not stop", "We kept waiting for it to slow down. It never seemed to get the message.", "12 January 2026", "story", 4, 1)] },
      { id: "library", name: "Library", roomNumber: "G-09", memoryCount: 108, accent: "ochre", memories: [memory("corner-table", "The corner table", "The table by the window was always taken, even when nobody was sitting there.", "21 August 2025", "photo", 14, 5), memory("book-nobody", "The book nobody returned", "It moved from bag to bag until we stopped asking.", "10 May 2025", "story", 7, 2), memory("exam-silence", "Exam-week silence", "Even the corridor outside felt quieter that week.", "18 March 2025", "event", 9, 4)] },
      { id: "reception", name: "Reception", roomNumber: "G-01", memoryCount: 24, accent: "neutral", memories: [memory("late-slip", "The late-slip queue", "A small line, a missing pen and the same excuse as every Monday.", "09 July 2025", "story", 3, 1)] },
    ],
  },
  {
    id: "first-floor",
    name: "First Floor",
    rooms: [
      { id: "class-xib", name: "Class XI-B", roomNumber: "F-11", memoryCount: 86, accent: "moss", memories: [memory("window-seat", "The window seat", "A great view of the rain. A terrible view of the blackboard.", "06 September 2025", "photo", 12, 3)] },
      { id: "computer-lab", name: "Computer Lab", roomNumber: "F-03", memoryCount: 54, accent: "teal", memories: [memory("printer", "The printer gave up", "It waited until the last page to become everyone's problem.", "22 November 2025", "event", 6, 2)] },
      { id: "art-room", name: "Art Room", roomNumber: "F-07", memoryCount: 61, accent: "terracotta", memories: [memory("paint-water", "Paint water everywhere", "We ran out of clean jars and carried on anyway.", "14 July 2025", "photo", 10, 3)] },
      { id: "staff-room", name: "Staff Room", roomNumber: "F-01", memoryCount: 18, accent: "neutral", memories: [memory("lost-marker", "The missing marker", "Found in the meeting room, as usual.", "03 February 2025", "story", 2, 0)] },
    ],
  },
  {
    id: "second-floor",
    name: "Second Floor",
    rooms: [
      { id: "music-room", name: "Music Room", roomNumber: "S-02", memoryCount: 37, accent: "ochre", memories: [memory("first-rehearsal", "The first rehearsal", "The song was not ready, but the room was full.", "02 October 2025", "event", 8, 2)] },
      { id: "archive-room", name: "Archive Room", roomNumber: "S-06", memoryCount: 19, accent: "neutral", memories: [memory("old-registers", "The old registers", "Names and handwriting from a different school year.", "17 April 2025", "photo", 5, 1)] },
      { id: "north-stairwell", name: "North Stairwell", roomNumber: "S-09", memoryCount: 13, accent: "moss", memories: [memory("shortcut", "The unofficial shortcut", "Four flights of stairs saved exactly no time.", "29 January 2025", "story", 4, 1)] },
      { id: "rooftop-hall", name: "Rooftop Hall", roomNumber: "S-12", memoryCount: 28, accent: "neutral", memories: [memory("last-bell", "The last bell", "The sound carried farther from up there.", "11 March 2025", "event", 9, 2)] },
    ],
  },
  {
    id: "sports-area",
    name: "Sports Area",
    rooms: [
      { id: "basketball-court", name: "Basketball Court", roomNumber: "P-01", memoryCount: 66, accent: "moss", memories: [memory("final-point", "The final point", "Nobody remembers the score, only who took the shot.", "18 December 2025", "event", 15, 6), memory("lunch-tournament", "Lunch-break tournament", "Three teams, one ball, and a very flexible rulebook.", "22 August 2025", "story", 10, 4)] },
      { id: "main-ground", name: "Main Ground", roomNumber: "P-02", memoryCount: 91, accent: "moss", memories: [memory("sports-day", "Sports Day practice", "The relay baton kept changing hands before the race began.", "08 November 2025", "photo", 13, 4)] },
      { id: "indoor-hall", name: "Indoor Hall", roomNumber: "P-04", memoryCount: 42, accent: "neutral", memories: [memory("rain-plan", "The rain plan", "Every outdoor event has an indoor version somewhere.", "01 July 2025", "event", 5, 1)] },
      { id: "equipment-room", name: "Equipment Room", roomNumber: "P-07", memoryCount: 16, accent: "ochre", memories: [memory("missing-bibs", "The missing bibs", "The cupboard had a system. Nobody knew it.", "14 October 2025", "story", 4, 1)] },
    ],
  },
  {
    id: "auditorium",
    name: "Auditorium",
    rooms: [
      { id: "main-stage", name: "Main Stage", roomNumber: "A-01", memoryCount: 74, accent: "rust", memories: [memory("microphone", "The microphone stopped working", "The audience waited. The backstage team improvised.", "07 December 2025", "event", 18, 7), memory("annual-day", "Annual Day rehearsals", "A month of entrances, exits and one stubborn curtain.", "21 November 2025", "photo", 13, 4)] },
      { id: "backstage", name: "Backstage", roomNumber: "A-02", memoryCount: 38, accent: "rust", memories: [memory("before-performance", "Backstage before the performance", "Quiet voices, safety pins and a last-minute pep talk.", "07 December 2025", "story", 12, 3)] },
      { id: "green-room", name: "Green Room", roomNumber: "A-03", memoryCount: 27, accent: "moss", memories: [memory("costume-rack", "The costume rack", "Everything was labelled except the things we needed.", "28 November 2025", "photo", 7, 2)] },
      { id: "sound-booth", name: "Sound Booth", roomNumber: "A-04", memoryCount: 21, accent: "neutral", memories: [memory("cue-sheet", "The cue sheet", "A small piece of paper carrying the whole evening.", "07 December 2025", "event", 5, 1)] },
    ],
  },
];

function AreaNavigation({ areas, selectedAreaId, onSelect }: { areas: DemoArea[]; selectedAreaId: string; onSelect: (areaId: string) => void }) {
  return (
    <aside className="mm-demo-sidebar" aria-label="Campus areas">
      <div className="mm-demo-sidebar__heading"><span className="mm-demo-label">Campus</span><span className="mm-demo-sidebar__mark" aria-hidden="true" /></div>
      <nav className="mm-demo-area-list" aria-label="Areas and floors">
        {areas.map((area) => <button type="button" key={area.id} className={area.id === selectedAreaId ? "is-active" : ""} aria-current={area.id === selectedAreaId ? "page" : undefined} onClick={() => onSelect(area.id)}><span>{area.name}</span><small>{area.rooms.length}</small></button>)}
      </nav>
      <div className="mm-demo-sidebar__bottom"><button type="button"><span className="mm-demo-sidebar__icon" aria-hidden="true">+</span> Members <small>14</small></button><button type="button"><span className="mm-demo-sidebar__settings" aria-hidden="true" /> Campus settings</button></div>
    </aside>
  );
}

export default function HomeCampusDemo() {
  const [selectedAreaId, setSelectedAreaId] = useState(demoAreas[0].id);
  const [selectedRoomId, setSelectedRoomId] = useState(demoAreas[0].rooms[0].id);
  const [filter, setFilter] = useState<DemoMemoryFilter>("all");
  const selectedArea = useMemo(() => demoAreas.find((area) => area.id === selectedAreaId) ?? demoAreas[0], [selectedAreaId]);
  const selectedRoom = useMemo(() => selectedArea.rooms.find((room) => room.id === selectedRoomId) ?? selectedArea.rooms[0], [selectedArea, selectedRoomId]);

  const selectArea = (areaId: string) => {
    const area = demoAreas.find((item) => item.id === areaId) ?? demoAreas[0];
    setSelectedAreaId(area.id);
    setSelectedRoomId(area.rooms[0].id);
    setFilter("all");
  };

  return (
    <section id="demo" className="mm-demo mm-frame mm-anchor" aria-labelledby="demo-title">
      <div className="mm-demo__toolbar">
        <div className="mm-demo__identity"><MemoryMapLogo size={46} variant="dark" /><div><strong>ABC School</strong><span className="mm-demo-private"><i aria-hidden="true" /> Private</span></div></div>
        <div className="mm-demo__toolbar-actions"><button type="button" className="mm-demo-search"><span aria-hidden="true" /> Search memories</button><div className="mm-demo-avatars" aria-label="14 campus members"><span>AS</span><span>RK</span><span>MP</span><b>+11</b></div><button type="button" className="mm-demo-add">Add memory <span aria-hidden="true">+</span></button></div>
      </div>
      <div className="mm-demo__body">
        <AreaNavigation areas={demoAreas} selectedAreaId={selectedArea.id} onSelect={selectArea} />
        <div className="mm-demo-workspace">
          <div className="mm-demo-workspace__heading"><div><span className="mm-demo-label">ABC School / {selectedArea.name}</span><h2 id="demo-title">{selectedArea.name}</h2></div><span>{selectedArea.rooms.length} rooms <i aria-hidden="true" /> {selectedArea.rooms.reduce((total, room) => total + room.memoryCount, 0)} memories</span></div>
          <div className="mm-demo-map" aria-label={`${selectedArea.name} room layout`}>
            <span className="mm-demo-map__corridor mm-demo-map__corridor--horizontal" aria-hidden="true" /><span className="mm-demo-map__corridor mm-demo-map__corridor--vertical" aria-hidden="true" /><span className="mm-demo-map__corridor-label" aria-hidden="true">Shared corridor</span><span className="mm-demo-map__north" aria-hidden="true">N</span>
            <div className="mm-demo-rooms">{selectedArea.rooms.map((room) => <DemoRoomCard key={room.id} room={room} selected={room.id === selectedRoom.id} onSelect={setSelectedRoomId} />)}</div>
            <span className="mm-demo-map__entrance"><i aria-hidden="true" /> Main entrance</span>
          </div>
          <div className="mm-demo-workspace__footer"><span>Select a room to open its memories.</span><span className="mm-demo-workspace__hint">{selectedRoom.name} selected <b aria-hidden="true">●</b></span></div>
        </div>
        <DemoMemoryPanel room={selectedRoom} filter={filter} onFilterChange={setFilter} />
      </div>
    </section>
  );
}
