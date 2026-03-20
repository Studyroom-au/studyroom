import AlexBuddy from "@/components/AlexBuddy";

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AlexBuddy />
    </>
  );
}
