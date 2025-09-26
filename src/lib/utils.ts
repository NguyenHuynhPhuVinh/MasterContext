import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- HÀM MỚI ---
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatPrice(priceString: string): string {
  try {
    const price = parseFloat(priceString);
    if (isNaN(price) || price === 0) return "Free";
    const pricePerMillion = price * 1_000_000;
    return `$${pricePerMillion.toFixed(2)}`;
  } catch {
    return "N/A";
  }
}

// --- HÀM MỚI: THROTTLE ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    lastArgs = args;
    if (!inThrottle) {
      inThrottle = true;
      func.apply(this, args);
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          // Nếu có cuộc gọi nào bị bỏ lỡ, thực hiện cuộc gọi cuối cùng
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, delay);
    } else if (timeoutId === null) {
      // Đảm bảo cập nhật cuối cùng sau khi hết throttle
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
        timeoutId = null;
      }, delay);
    }
  };
}
