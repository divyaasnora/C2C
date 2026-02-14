import cv2
import time
import sys

RTSP_URL = sys.argv[1]

cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    print("ERROR")
    sys.stdout.flush()
    exit(1)

fgbg = cv2.createBackgroundSubtractorMOG2(history=200, varThreshold=25, detectShadows=True)

last_status = "CLEAR"
last_alarm_time = 0
COOLDOWN = 2.0
MIN_AREA = 800

while True:
    ret, frame = cap.read()
    if not ret:
        time.sleep(0.5)
        continue

    frame = cv2.resize(frame, (640, 360))
    fgmask = fgbg.apply(frame)
    fgmask = cv2.GaussianBlur(fgmask, (5, 5), 0)
    _, fgmask = cv2.threshold(fgmask, 200, 255, cv2.THRESH_BINARY)
    fgmask = cv2.dilate(fgmask, None, iterations=2)

    contours, _ = cv2.findContours(fgmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    movement = any(cv2.contourArea(c) > MIN_AREA for c in contours)
    now = time.time()

    if movement and last_status != "ALARM" and (now - last_alarm_time) > COOLDOWN:
        print("ALARM")
        sys.stdout.flush()
        last_status = "ALARM"
        last_alarm_time = now

    elif not movement and last_status != "CLEAR":
        print("CLEAR")
        sys.stdout.flush()
        last_status = "CLEAR"
