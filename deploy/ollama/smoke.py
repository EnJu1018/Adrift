"""Run over SSH stdin on the inference host. Synthetic prompts only; no files changed."""
import json
import subprocess
import threading
import time
import urllib.error
import urllib.request

MODEL = "qwen3.5:4b-q4_K_M"
BASE = "http://127.0.0.1:11434"


def request(path, body=None):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.load(response)


def gpu():
    values = subprocess.check_output([
        "nvidia-smi", "--query-gpu=memory.used,utilization.gpu", "--format=csv,noheader,nounits"
    ], timeout=5, text=True).splitlines()[0].split(",")
    return int(values[0].strip()), int(values[1].strip())


def run(name, context, messages, check, **extra):
    samples = []
    stop = threading.Event()

    def monitor():
        while not stop.is_set():
            try:
                samples.append(gpu()[0])
            except (OSError, subprocess.SubprocessError, ValueError):
                pass
            stop.wait(0.25)

    watcher = threading.Thread(target=monitor)
    watcher.start()
    started = time.monotonic()
    try:
        value = request("/api/chat", {
            "model": MODEL, "messages": messages, "stream": False, "think": False,
            "keep_alive": "30s", "options": {"num_ctx": context, "num_predict": 128, "temperature": 0}, **extra
        })
        loaded = next((item for item in request("/api/ps")["models"] if item["name"] == MODEL), {})
        passed = value.get("done") is True and value.get("done_reason") == "stop" and check(value)
        duration = value.get("eval_duration", 0)
        print(json.dumps({
            "test": name, "passed": bool(passed), "requestedContext": context,
            "loadedContext": loaded.get("context_length"), "wallSeconds": round(time.monotonic() - started, 3),
            "promptTokens": value.get("prompt_eval_count"), "outputTokens": value.get("eval_count"),
            "loadMs": round(value.get("load_duration", 0) / 1e6, 2),
            "tokensPerSecond": round(value.get("eval_count", 0) * 1e9 / duration, 2) if duration else None,
            "modelVramMiB": round(loaded.get("size_vram", 0) / 1048576, 2),
            "gpuPeakSampledMiB": max(samples, default=0), "gpuSampleCount": len(samples),
            "text": value.get("message", {}).get("content", "")[:160],
            "toolCalls": value.get("message", {}).get("tool_calls", [])
        }, ensure_ascii=False), flush=True)
        return bool(passed) and loaded.get("context_length") == context
    except (urllib.error.URLError, ValueError, KeyError, StopIteration) as error:
        print(json.dumps({"test": name, "passed": False, "errorType": type(error).__name__, "status": getattr(error, "code", None)}), flush=True)
        return False
    finally:
        stop.set()
        watcher.join(timeout=6)


initial = request("/api/ps")["models"]
if any(item["name"] != MODEL for item in initial) or gpu()[1] > 0:
    raise SystemExit("Inference host is busy; refusing to compete with another workload")
print(json.dumps({"version": request("/api/version")["version"], "initialGpuMiB": gpu()[0], "initialLoadedModels": [item["name"] for item in initial]}), flush=True)
results = []
results.append(run("traditional-chinese-4k", 4096, [{"role": "user", "content": "請以繁體中文回覆這句話：歡迎回到漂流足跡。"}],
                   lambda value: "歡迎" in value["message"]["content"] and "漂流足跡" in value["message"]["content"]))
schema = {"type": "object", "properties": {"status": {"type": "string", "enum": ["ok"]}, "message": {"type": "string"}}, "required": ["status", "message"], "additionalProperties": False}
results.append(run("json-schema-4k", 4096, [{"role": "user", "content": "輸出 JSON，status 是 ok，message 是繁體中文的測試完成。"}],
                   lambda value: json.loads(value["message"]["content"]).get("status") == "ok", format=schema))
tool = {"type": "function", "function": {"name": "lookup_memory", "description": "查詢合成測試記憶；不會實際執行工具。", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"], "additionalProperties": False}}}
results.append(run("tool-calling-4k", 4096, [{"role": "user", "content": "請呼叫 lookup_memory，query 設為「河邊散步」，不要自行回答。"}],
                   lambda value: any(call.get("function", {}).get("name") == "lookup_memory" and call["function"].get("arguments", {}).get("query") == "河邊散步" for call in value["message"].get("tool_calls", [])), tools=[tool]))
results.append(run("traditional-chinese-8k", 8192, [{"role": "user", "content": "請以繁體中文回覆這句話：記憶留在發生的地方。"}],
                   lambda value: "記憶" in value["message"]["content"] and "地方" in value["message"]["content"]))
print(json.dumps({"passed": sum(results), "total": len(results), "note": "Context allocation checks, not full-window quality or concurrency benchmarks"}), flush=True)
raise SystemExit(0 if all(results) else 1)
