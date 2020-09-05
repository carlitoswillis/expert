FROM ubuntu
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y tesseract-ocr
ENTRYPOINT [ "tesseract" ]