
FROM python:3.11-slim
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    CHROMA_SERVER_HOST=0.0.0.0 \
    CHROMA_SERVER_HTTP_PORT=7860

WORKDIR $HOME/app

RUN pip install --no-cache-dir chromadb

RUN mkdir -p $HOME/app/data

EXPOSE 7860

CMD ["chroma", "run", "--host", "0.0.0.0", "--port", "7860", "--path", "./data"]