export function log(message: string) {
  document.getElementById('debug-log')!.innerHTML += `<span class="text-blue-500">${message}</span><br>`;
}

export function error(message: string) {
  document.getElementById('debug-log')!.innerHTML += `<span class="text-red-500">${message}</span><br>`;
}