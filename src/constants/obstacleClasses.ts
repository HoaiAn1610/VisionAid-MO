// Class YOLO (COCO) → tên tiếng Việt + cờ nguy hiểm (Minimal Mode chỉ announce `dangerous`).
// Chốt lại theo class model thực tế hỗ trợ sau khi benchmark.
export interface ObstacleClassInfo {
  nameVi: string;
  dangerous: boolean;
}

export const ObstacleClasses: Record<string, ObstacleClassInfo> = {
  person: { nameVi: 'Người', dangerous: false },
  bicycle: { nameVi: 'Xe đạp', dangerous: true },
  car: { nameVi: 'Ô tô', dangerous: true },
  motorcycle: { nameVi: 'Xe máy', dangerous: true },
  bus: { nameVi: 'Xe buýt', dangerous: true },
  truck: { nameVi: 'Xe tải', dangerous: true },
  'traffic light': { nameVi: 'Đèn giao thông', dangerous: false },
  'fire hydrant': { nameVi: 'Trụ cứu hỏa', dangerous: false },
  'stop sign': { nameVi: 'Biển dừng', dangerous: false },
  bench: { nameVi: 'Ghế băng', dangerous: false },
  dog: { nameVi: 'Con chó', dangerous: false },
  chair: { nameVi: 'Ghế', dangerous: false },
  'potted plant': { nameVi: 'Chậu cây', dangerous: false },
  'dining table': { nameVi: 'Bàn', dangerous: false },
  couch: { nameVi: 'Ghế sofa', dangerous: false },
  cat: { nameVi: 'Con mèo', dangerous: false },
  // Đồ để dưới đất, dễ vấp
  backpack: { nameVi: 'Ba lô', dangerous: false },
  suitcase: { nameVi: 'Va li', dangerous: false },
  handbag: { nameVi: 'Túi xách', dangerous: false },
};
