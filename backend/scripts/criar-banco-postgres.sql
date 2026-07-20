-- Rode este script no pgAdmin 4 (PostgreSQL 18) conectado como usuário postgres.
-- Depois, em application.properties troque para: spring.profiles.active=postgres

CREATE USER pelada WITH PASSWORD 'pelada123';
CREATE DATABASE pelada_oficial OWNER pelada;
GRANT ALL PRIVILEGES ON DATABASE pelada_oficial TO pelada;

\c pelada_oficial
GRANT ALL ON SCHEMA public TO pelada;
ALTER SCHEMA public OWNER TO pelada;
