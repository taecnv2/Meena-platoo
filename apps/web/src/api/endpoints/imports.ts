import { axiosClient } from '../axiosClient'
import type { ImportIngredientRow, ImportResult } from '@/types/entities'

export const importsApi = {
  /** dryRun=true validates and previews only; dryRun=false writes. */
  ingredients: (rows: ImportIngredientRow[], dryRun: boolean) =>
    axiosClient.post<ImportResult>('/imports/ingredients', { rows, dryRun }).then((r) => r.data),
}
