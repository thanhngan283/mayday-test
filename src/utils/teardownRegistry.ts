import { apiClients } from '../clients/apiClient';

export interface CleanupTask {
  description: string;
  execute: () => Promise<void>;
}

/**
 * TeardownRegistry quản lý danh sách các tài nguyên được tạo ra trên Database thực tế
 * trong quá trình chạy Setup/Test và tự động gọi các API DELETE tương ứng theo thứ tự LIFO
 * (Last-In-First-Out) để tránh lỗi khóa ngoại (RESTRICT/FOREIGN KEY) và trả DB về trạng thái sạch.
 */
export class TeardownRegistry {
  private tasks: CleanupTask[] = [];

  public register(taskOrDescription: CleanupTask | string, execute?: () => Promise<void>): void {
    if (typeof taskOrDescription === 'string') {
      if (execute) {
        this.tasks.push({ description: taskOrDescription, execute });
      }
    } else {
      this.tasks.push(taskOrDescription);
    }
  }

  public registerMedicalRecord(recordId: number | string, adminToken: string): void {
    this.register(`DELETE Medical Record ID=${recordId}`, async () => {
      await apiClients.medrec.delete(`/api/medical_records/${recordId}`, { token: adminToken });
    });
  }

  public registerTemplateQuestion(questionId: string, adminToken: string): void {
    this.register(`DELETE Template Question ID=${questionId}`, async () => {
      await apiClients.template.delete(`/api/templates/questions/${questionId}`, { token: adminToken });
    });
  }

  public registerTemplateSection(sectionId: number | string, adminToken: string): void {
    this.register(`DELETE Template Section ID=${sectionId}`, async () => {
      await apiClients.template.delete(`/api/templates/sections/${sectionId}`, { token: adminToken });
    });
  }

  public registerTemplate(templateCode: string, adminToken: string): void {
    this.register(`DELETE Template Code=${templateCode}`, async () => {
      await apiClients.template.delete(`/api/templates/${templateCode}`, { token: adminToken });
    });
  }

  public registerUser(userId: number | string, adminToken: string): void {
    this.register(`DELETE User ID=${userId}`, async () => {
      await apiClients.userRole.delete(`/api/admin/users/${userId}`, { token: adminToken });
    });
  }

  public registerLesionPhoto(photoId: number | string, token: string): void {
    this.register(`DELETE Lesion Photo ID=${photoId}`, async () => {
      await apiClients.imageUas7.delete(`/api/lesion-photos/${photoId}`, { token });
    });
  }

  public registerLesionLocation(locationId: number | string, token: string): void {
    this.register(`DELETE Lesion Location ID=${locationId}`, async () => {
      await apiClients.lesion.delete(`/api/lesion-locations/${locationId}`, { token });
    });
  }

  public registerLesionEpisode(episodeId: number | string, token: string): void {
    this.register(`DELETE Lesion Episode ID=${episodeId}`, async () => {
      await apiClients.lesion.delete(`/api/lesion-episodes/${episodeId}`, { token });
    });
  }

  public registerAnswerImage(answerImageId: number | string, token: string): void {
    this.register(`DELETE Answer Image ID=${answerImageId}`, async () => {
      await apiClients.imageUas7.delete(`/api/answer-images/${answerImageId}`, { token });
    });
  }

  public registerImageAttachment(imageId: number | string, token: string): void {
    this.register(`DELETE Image Attachment ID=${imageId}`, async () => {
      await apiClients.imageUas7.delete(`/api/image-attachments/${imageId}`, { token });
    });
  }

  public registerNotification(notificationId: number | string, token: string): void {
    this.register(`DELETE Notification ID=${notificationId}`, async () => {
      await apiClients.prescriptionLabNoti.delete(`/api/notifications/${notificationId}`, { token });
    });
  }

  public registerRoom(roomId: number | string, adminToken: string): void {
    this.register(`DELETE Room ID=${roomId}`, async () => {
      await apiClients.template.delete(`/api/v1/rooms/${roomId}`, { token: adminToken });
    });
  }

  public registerDepartment(departmentId: number | string, adminToken: string): void {
    this.register(`DELETE Department ID=${departmentId}`, async () => {
      await apiClients.template.delete(`/api/v1/departments/${departmentId}`, { token: adminToken });
    });
  }

  public registerBranch(branchId: number | string, adminToken: string): void {
    this.register(`DELETE Branch ID=${branchId}`, async () => {
      await apiClients.orgPermission.delete(`/api/v1/branches/${branchId}`, { token: adminToken });
    });
  }

  public registerPermission(permissionId: number | string, adminToken: string): void {
    this.register(`DELETE Permission ID=${permissionId}`, async () => {
      await apiClients.orgPermission.delete(`/api/v1/permissions/${permissionId}`, { token: adminToken });
    });
  }

  /**
   * Thực thi dọn dẹp theo thứ tự đảo ngược (LIFO) để xóa bản ghi con trước bản ghi cha.
   */
  public async cleanupAll(): Promise<void> {
    const reversedTasks = [...this.tasks].reverse();
    this.tasks = [];

    for (const task of reversedTasks) {
      try {
        await task.execute();
      } catch (err) {
        console.warn(`[TEARDOWN WARNING] Failed to execute "${task.description}":`, err);
      }
    }
  }
}
