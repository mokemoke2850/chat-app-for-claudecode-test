FROM postgres:16-alpine

ENV POSTGRES_DB=chatapp
ENV POSTGRES_USER=chatapp
ENV POSTGRES_PASSWORD=chatapp

# ヘルスチェック用
HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
  CMD pg_isready -U chatapp -d chatapp || exit 1

EXPOSE 5432
