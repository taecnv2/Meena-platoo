import { axiosClient } from './axiosClient'
import { downloadFile } from './downloadFile'

export function createCrudApi<T, TCreate = Partial<T>, TUpdate = Partial<T>>(resource: string) {
  return {
    list: () => axiosClient.get<T[]>(`/${resource}`).then((response) => response.data),
    get: (id: string) => axiosClient.get<T>(`/${resource}/${id}`).then((response) => response.data),
    create: (payload: TCreate) => axiosClient.post<T>(`/${resource}`, payload).then((response) => response.data),
    update: (id: string, payload: TUpdate) =>
      axiosClient.patch<T>(`/${resource}/${id}`, payload).then((response) => response.data),
    exportFile: (format: 'csv' | 'pdf') => downloadFile(`/${resource}/export`, { format }),
  }
}
