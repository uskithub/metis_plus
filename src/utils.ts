export const sleep = (wait: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, wait * 1000)
  })
}
