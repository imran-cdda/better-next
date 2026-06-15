CREATE TABLE "database" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"user" text NOT NULL,
	"password" text NOT NULL,
	"database" text NOT NULL,
	"domain" text NOT NULL,
	"provider" text NOT NULL
);
