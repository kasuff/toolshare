import type { Booking, BookingPickupProposal } from "@prisma/client";

type ProposalLike = Pick<BookingPickupProposal, "status" | "proposedPickupTime">;

/** Value that the next proposal replaces (latest pending offer, else baseline after accepted). */
export function computePreviousPickupForNewProposal(
  booking: Pick<Booking, "pickupTime">,
  proposalsAsc: ProposalLike[]
): Date | null {
  if (!booking.pickupTime) return null;
  let baseline = booking.pickupTime;
  for (const p of proposalsAsc) {
    if (p.status === "ACCEPTED") {
      baseline = p.proposedPickupTime;
    }
  }
  const pendings = proposalsAsc.filter((p) => p.status === "PENDING");
  const lastPending = pendings.at(-1);
  if (lastPending) {
    return lastPending.proposedPickupTime;
  }
  return baseline;
}
