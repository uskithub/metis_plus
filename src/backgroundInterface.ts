import { Empty, SwiftEnum, SwiftEnumCases } from "./enum"

export type ActionContext = {
  setupWhispter: Empty
  setModel: { model: Uint8Array }
}

export const Actions = new SwiftEnum<ActionContext>()
export type Actions = SwiftEnumCases<ActionContext>

export type ResponseContext = {
  [Actions.keys.setupWhispter]: { isSuccess: boolean }
  [Actions.keys.setModel]: { isSuccess: boolean }
}

export const Responses = new SwiftEnum<ResponseContext>()
export type Responses = SwiftEnumCases<ResponseContext>
