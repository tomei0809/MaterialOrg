"""プログラミング演習 課題3：ソートアルゴリズムの比較（デモ用のサンプル）"""
import random
import time


def bubble_sort(values):
    """隣どうしを比べて入れ替える。計算量は O(n^2)"""
    a = list(values)
    for i in range(len(a)):
        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a


def merge_sort(values):
    """半分に分けて並べ、混ぜ合わせる。計算量は O(n log n)"""
    if len(values) <= 1:
        return list(values)
    middle = len(values) // 2
    left, right = merge_sort(values[:middle]), merge_sort(values[middle:])
    merged = []
    while left and right:
        merged.append(left.pop(0) if left[0] <= right[0] else right.pop(0))
    return merged + left + right


def measure(sort, values):
    start = time.perf_counter()
    sort(values)
    return time.perf_counter() - start


if __name__ == "__main__":
    for n in (100, 1000, 3000):
        data = [random.randint(0, 10_000) for _ in range(n)]
        print(f"n={n:5d}  bubble={measure(bubble_sort, data):.4f}s  merge={measure(merge_sort, data):.4f}s")
