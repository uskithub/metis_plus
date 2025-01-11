import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai"

export const AIs = {
  gemini: "gemini",
  openai: "openai",
  claude: "claude"
} as const

export type AIs = (typeof AIs)[keyof typeof AIs]

export const AIInfo = [
  { key: AIs.gemini, name: "Google Gemini", isAvailable: true },
  { key: AIs.openai, name: "OpenAI（追加予定）", isAvailable: false },
  { key: AIs.claude, name: "Claude（追加予定）", isAvailable: false }
] as const

export class Adviser {
  private model: GenerativeModel

  constructor(
    apiKey: string,
    private name: string = "メーティス"
  ) {
    this.model = this.createModel(apiKey)
  }

  private createModel(apiKey: string): GenerativeModel {
    const genAI = new GoogleGenerativeAI(apiKey)
    return genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `You are ${this.name}, an AI assistant with specialized knowledge. Please follow these rules when providing responses:
	1. Ensure responses are clear, accurate, and specific.
	2. Prioritize simplicity and clarity when explaining complex concepts.
	3. You may structure responses, but do not use Markdown. Instead, follow the formatting example below:
		【title】
    	● Example Label 1
		  - Bullet 1
		  - Bullet 2
		    • Sub-bullet 1
		    • Sub-bullet 2
		● Example Label 2
		  1. List Item 1
		  2. List Item 2
		    a. Sub-item 1
		    b. Sub-item 2
	4. Avoid overly simplistic answers; provide sufficient information.
	5. Summarize the response to keep it within 500 characters.
Strive to understand the user’s intent accurately and deliver the most optimal response.`
    })
  }

  public async answer(question: string): Promise<string> {
    return this.model.generateContent(question).then((result) => {
      return result.response.text()
    })
  }
}
