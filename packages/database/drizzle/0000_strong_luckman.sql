CREATE TABLE "experience_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text DEFAULT '1.0.0' NOT NULL,
	"portal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurred_on" text,
	"task_type" text NOT NULL,
	"task_description" varchar(280),
	"outcome" text NOT NULL,
	"themes" text[] DEFAULT '{}'::text[] NOT NULL,
	"device_type" text,
	"experience_rating" smallint,
	"free_text" varchar(1000),
	"consent_to_publish" boolean NOT NULL,
	"source" text NOT NULL,
	"privacy_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"duplicate_of" uuid,
	"seed_key" text,
	CONSTRAINT "experience_submissions_seed_key_unique" UNIQUE("seed_key"),
	CONSTRAINT "experience_submissions_outcome_check" CHECK ("experience_submissions"."outcome" IN ('completed', 'partially_completed', 'not_completed', 'information_only')),
	CONSTRAINT "experience_submissions_device_type_check" CHECK ("experience_submissions"."device_type" IS NULL OR "experience_submissions"."device_type" IN ('mobile', 'desktop', 'tablet', 'other')),
	CONSTRAINT "experience_submissions_source_check" CHECK ("experience_submissions"."source" IN ('public_form', 'research_interview')),
	CONSTRAINT "experience_submissions_rating_check" CHECK ("experience_submissions"."experience_rating" IS NULL OR "experience_submissions"."experience_rating" BETWEEN 1 AND 5),
	CONSTRAINT "experience_submissions_themes_check" CHECK ("experience_submissions"."themes" <@ ARRAY['availability', 'navigation', 'content_clarity', 'outdated_information', 'login_or_otp', 'form_or_validation', 'payment', 'document_upload', 'mobile_usability', 'language', 'accessibility', 'support', 'other']::text[])
);
--> statement-breakpoint
CREATE TABLE "experience_moderation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"moderated_at" timestamp with time zone,
	"moderation_reason_code" text,
	"public_text" varchar(1000),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experience_moderation_submission_id_unique" UNIQUE("submission_id"),
	CONSTRAINT "experience_moderation_status_check" CHECK ("experience_moderation"."status" IN ('pending', 'approved', 'rejected', 'needs_redaction'))
);
--> statement-breakpoint
CREATE TABLE "experience_abuse_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyed_hash" text NOT NULL,
	"portal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience_schema_meta" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"experience_submission_schema_version" text NOT NULL,
	"portal_experience_summary_schema_version" text NOT NULL,
	"last_migrated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "experience_moderation" ADD CONSTRAINT "experience_moderation_submission_id_experience_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."experience_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experience_submissions_portal_id_idx" ON "experience_submissions" USING btree ("portal_id");--> statement-breakpoint
CREATE INDEX "experience_submissions_created_at_idx" ON "experience_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "experience_moderation_status_idx" ON "experience_moderation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "experience_moderation_pending_idx" ON "experience_moderation" USING btree ("submission_id") WHERE "experience_moderation"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "experience_abuse_keys_hash_created_idx" ON "experience_abuse_keys" USING btree ("keyed_hash","created_at");--> statement-breakpoint
CREATE INDEX "experience_abuse_keys_hash_portal_created_idx" ON "experience_abuse_keys" USING btree ("keyed_hash","portal_id","created_at");--> statement-breakpoint
CREATE INDEX "experience_abuse_keys_expires_at_idx" ON "experience_abuse_keys" USING btree ("expires_at");