import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";

export class Adviser {
  private model: GenerativeModel;

  constructor(private name: string = "メーティス") {
    this.model = this.createModel();
  }

  private createModel(): GenerativeModel {
    const genAI = new GoogleGenerativeAI("__SET_YOUR_OWN_API_KEY__");
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
Strive to understand the user’s intent accurately and deliver the most optimal response.`,
    });
  }

  public async answer(question: string): Promise<string> {
    return this.model.generateContent(question).then((result) => {
      return result.response.text();
    });
  }
}
