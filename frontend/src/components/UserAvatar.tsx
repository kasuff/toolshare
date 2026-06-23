export function UserAvatar({
  name,
  imageUrl,
  size,
}: {
  name: string;
  imageUrl?: string | null;
  size: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const letter = initials || "?";

  if (imageUrl) {
    return <img src={imageUrl} alt="" className={`msg-avatar msg-avatar-${size}`} />;
  }

  return (
    <span className={`msg-avatar msg-avatar-${size} msg-avatar-fallback`} aria-hidden="true">
      {letter}
    </span>
  );
}
