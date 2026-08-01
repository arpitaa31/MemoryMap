type MemoryMapWordmarkProps = {
  className?: string;
};

export default function MemoryMapWordmark({ className = "" }: MemoryMapWordmarkProps) {
  return (
    <span className={`mm-wordmark ${className}`.trim()} aria-label="MemoryMap">
      <span>Memory</span><span className="mm-wordmark__map">Map</span>
    </span>
  );
}
