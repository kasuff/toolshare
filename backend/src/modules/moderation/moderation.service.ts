import { AppError } from "../../utils/app-error";
import { moderationRepository } from "./moderation.repository";

export const moderationService = {
  createReport(input: { reporterId: string; bookingId?: string; reason: string; details?: string }) {
    return moderationRepository.createReport(input);
  },

  listReports() {
    return moderationRepository.listOpenReports();
  },

  async updateReportStatus(input: {
    reportId: string;
    status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
    moderatorId: string;
  }) {
    const report = await moderationRepository.findById(input.reportId);
    if (!report) {
      throw new AppError("REPORT_NOT_FOUND", "Report not found", 404);
    }

    return moderationRepository.updateStatus(input.reportId, input.status, input.moderatorId);
  }
};
