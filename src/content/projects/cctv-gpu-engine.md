---
title: "CCTV GPU Engine: batch video analysis that turns surveillance footage into activity reports"
slug: "cctv-gpu-engine"
summary: "Batch video analysis that turns recorded CCTV footage into structured activity reports: how many people were present, when, and what they were doing."
client:
  sector: "Industrial video analytics"
capabilities:
  - "software"
  - "applied-r-and-d"
industry: "Industrial facilities"
year: 2026
stack:
  - "Python"
  - "ONNX Runtime"
  - "YOLO11-pose"
  - "OSNet"
  - "Qwen2.5-VL"
  - "PyTorch"
featured: false
order: 2
---

## TLDR

CCTV GPU Engine is a batch video-analysis system that turns recorded surveillance footage into structured activity reports: how many people were present, when, and how much time they spent sitting, standing, walking, or running. A small appliance at the client's site records the cameras; the analysis runs later on NVIDIA GPU servers, where a pose model, an appearance tracker, and a vision-language model process one hour of footage in about 20 minutes. It was built in four months (March–July 2026) for industrial facilities whose earlier attempts — home-grown scripts and camera-vendor analytics — had failed on quality or on price. Three clients with almost 20 cameras use it in production today.

## Key facts

- Processes one hour of footage in about 20 minutes on a single NVIDIA RTX 5070, peaking at about 7.9 GB of VRAM.
- Activity accuracy is about 85% with the hybrid VLM classifier versus about 45% for pure geometric heuristics, measured on a hand-annotated ground-truth set (sitting 89%, walking 96%).
- Recognizes exactly four activities: sitting, standing, walking, and running.
- Analyzes at 1 frame per second — a cost decision that shaped the entire architecture.
- Built between 2026-03-31 and 2026-07-31: 219 commits, 3 contributors, 269 tracked files.
- Models: YOLO11s-pose (640×640 and 1280×736 ONNX exports), OSNet x0.25 for appearance re-identification, Qwen2.5-VL-3B for posture classification.
- In production with three clients and almost 20 cameras.
- Canonical output is `result.json` (schema 6), which includes a recall-risk diagnostic that flags runs whose numbers should not be trusted.

## What is CCTV GPU Engine?

CCTV GPU Engine is a pipeline that watches recorded CCTV so a person does not have to. It takes ordinary MP4 recordings from existing surveillance cameras and returns a machine-readable report of who was visible, for how long, and what they were doing, aggregated into person-minutes per activity. A web platform renders that report into charts a manager can read.

**Quick answer:** input is ordinary surveillance video; output is a structured JSON report of presence and activity over time — not a live alert, not an identity, not a face.

It is deliberately batch-only. Footage is recorded first and analyzed later, which lets a single consumer GPU serve several cameras instead of one, and keeps the client's site free of any GPU hardware.

## What problem does it solve?

Surveillance cameras record continuously, but the recordings are almost never watched. They get opened after an incident — a theft, a dispute — and ignored the rest of the year. The information managers actually want from them is mundane: how many people were on the floor, at what hours, and how much of a shift was spent working at a station versus moving around.

The facilities this was built for had tried two things before: simple custom solutions, and analytics software from camera hardware vendors. The custom attempts did not hold up, and the vendor software's price was the blocker every time. **Key fact:** this project exists because of a price tag, not because the capability was missing from the market.

The service model removes both barriers at once. Clients keep their existing cameras, a small on-site appliance records them, and the GPU-heavy analysis runs on servers owned by hardware investors, sold as a service through the companion GPU Exchange platform. The client buys neither a GPU nor a software licence.

## How does it work?

Two halves: an on-site recorder and an off-site analysis engine. The recorder is a bare-metal mini-PC running systemd services. It records the cameras' RTSP streams into chunked MP4 files with ffmpeg (stream copy, no re-encoding) and keeps a rolling local buffer. When an analysis job is created, the appliance uploads the relevant chunks through presigned URLs — no cloud storage credentials ever live on-site.

The engine then runs the pipeline below on a GPU node.

| Stage | Component | What it does |
|---|---|---|
| Frame extraction | ffmpeg | Decodes 1 frame per second, streamed — the full video is never held in RAM |
| Person and pose detection | YOLO11s-pose (ONNX, CUDA) | Finds every person and 17 skeleton keypoints per frame |
| Tracking | OSNet x0.25 re-identification | Links detections into per-person tracks by appearance similarity, not position |
| Track filtering | Minimum-track filter | Drops detector flicker: a track only counts after 3 sightings within 5 frames |
| Activity classification | Qwen2.5-VL-3B + displacement | Posture judged from the image crop; walking and running from measured movement |
| Aggregation | Person-minutes | Per-track activity timelines summed into totals per zone and per hour |
| Diagnostics | Detection-scale signal | Flags runs where camera resolution makes people too small to detect reliably |

**Key fact:** the classifier is a hybrid on purpose. The vision-language model only judges stationary posture (sitting versus standing) from the image; whether someone is walking or running is decided by how far their bounding box actually moved between frames. Each method does only the part it is good at.

## Why analyze at 1 frame per second?

Cost. One frame per second is enough to measure presence and activity in minutes — the units the report is denominated in — and it reduces an hour of video to 3,600 frames. At that rate a single RTX 5070 processes an hour of footage in roughly 20 minutes with the full VLM classifier, and in about 7 minutes with the lightweight heuristic one.

The price of that decision is that most standard tracking techniques stop working. At 1 fps, a walking person moves so far between frames that their bounding boxes no longer overlap, so overlap-based (IoU) tracking has nothing to match. The engine instead computes an OSNet appearance embedding for every detection and links people across frames by how they look, not where they are.

**Quick answer:** 1 fps makes the analysis affordable; appearance-based re-identification is what makes tracking possible at that rate.

Tracking errors are also handled asymmetrically. Merging two people into one track silently corrupts a person-minutes report; splitting one person into two only shows up as a visible gap. Every threshold is therefore tuned to prefer splitting — when the system must be wrong, it chooses the error a reader can see.

## How accurate is it?

Three classifier approaches were built and measured against a hand-annotated ground-truth set. The results, including the failure, are kept in the repository.

| Classifier | Accuracy on ground truth | Time per 1 h of video | Peak VRAM | Status |
|---|---|---|---|---|
| Hybrid VLM (Qwen2.5-VL-3B + displacement) | ~85% (sitting 89%, walking 96%) | ~20 min | ~7.9 GB | Production default |
| Geometric heuristics on pose keypoints | ~45% | ~7 min | ~710 MiB | Supported fallback |
| Trained MLP on keypoints | Failed the frozen quality gate | — | — | Experimental; documented as "must not be promoted" |

The geometric approach — rules like "hips below knees means sitting" — turned out to be the weakest, and a purpose-trained neural classifier failed its evaluation gate. The general-purpose vision-language model looking at the actual image crop nearly doubled accuracy. **Key fact:** the losing evaluation is published inside the repository as a frozen negative result, so the failed approach cannot be quietly re-promoted later.

## What happens when the footage is not good enough?

Every result ships with diagnostics, not just numbers. The engine estimates, from the camera's resolution and the pose model's input scale, whether people of realistic size were resolvable at all. When they were not, the report carries a `recall_risk: high` flag and the platform shows the caveat to the client instead of presenting an undercounted run as a clean work-time measurement.

**In short: the engine prefers refusing a number to reporting a wrong one.** For difficult cameras — wide 4K overviews where a person is under 120 pixels tall — an opt-in hybrid pose mode tiles the frame at native resolution to recover distant people, at roughly 15 times the pose-detection cost.

## Steps: how a recorded hour becomes a report

1. The on-site appliance records each camera's RTSP stream into chunked MP4 files in a rolling local buffer.
2. A job is created on the platform; the appliance uploads the requested chunks through presigned URLs.
3. A GPU node claims the job and starts the engine container; a health check holds traffic until models and CUDA are warm.
4. ffmpeg streams frames out of the video at 1 frame per second.
5. YOLO11s-pose detects every person and their skeleton in each frame.
6. OSNet embeddings link detections into per-person tracks; the minimum-track filter drops flicker.
7. The hybrid classifier assigns each detection an activity: VLM for posture, displacement for motion.
8. Detections aggregate into per-track timelines and person-minutes; diagnostics record pose mode and recall risk.
9. `result.json` (schema 6) uploads through a presigned URL and the platform renders it.

## FAQ

### What activities can CCTV GPU Engine recognize?

Exactly four: sitting, standing, walking, and running. The taxonomy is fixed in the specification, and each class is measured the way it is most reliably detected — posture from the image, motion from displacement between frames.

### Does it identify who people are?

No. Tracking links detections of the same person within one video using appearance similarity, but there is no face recognition, no identity database, and no re-identification across separate videos or days. A track is an anonymous label like "person 3", valid only inside one analyzed recording.

### Does it watch cameras live?

No — batch only. Footage is recorded on-site and analyzed later on GPU servers. At a 3:1 processing ratio, one GPU keeps up with the continuous output of three cameras using the VLM classifier, or about eight with the heuristic one; live alerting is a different product with different economics.

### What hardware does a client need?

Existing RTSP-capable cameras plus a small mini-PC appliance that records them — no GPU on-site. The GPU side needs an NVIDIA card with CUDA 12.8 support and about 7.9 GB of free VRAM for the full classifier; the reference card is an RTX 5070.

### How long did it take to build?

Four months: 219 commits between 2026-03-31 and 2026-07-31, by 3 contributors. That includes benchmarking five classification approaches, hand-annotating ground-truth footage, and shipping one documented negative result.

### Why use a vision-language model instead of training a classifier?

Both were tried and measured. Geometric rules reached about 45% accuracy, a purpose-trained MLP failed its frozen evaluation gate, and Qwen2.5-VL-3B reading the actual image crops reached about 85%. The measured comparison, not a preference, decided the architecture.

### What does the recall-risk flag mean?

It means the engine judged that people of realistic size may have been too small at the analyzed resolution to detect reliably, so the counts are a lower bound rather than a measurement. The flag ships inside `result.json` and the platform displays it as a client-facing caveat.

### When should you not use it?

When you need live alerts, identity ("who is this person"), cross-day tracking of individuals, or activities outside the four supported classes. The engine is a measurement tool for presence and activity in recorded footage, and it is intentionally nothing else.

## Last updated

2026-08-10
