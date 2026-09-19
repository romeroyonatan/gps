import type { Afiliado, Declaracion } from './modelos'

/** Lo minimo que Afiliacion ofrece a otros modulos. */
export interface Afiliacion {
  listarDeclaraciones(): Promise<readonly Declaracion[]>
  listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>
}

declare module '@gps/core' {
  interface Eventos {
    AfiliacionDeclarada: Declaracion
  }
}
