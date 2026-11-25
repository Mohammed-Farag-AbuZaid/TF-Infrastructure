import { z } from 'zod';

export const IdeaSchema = z.object({
  title: z.string().trim().min(4, 'Title must be at least 4 characters').max(160),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(4000),
  division: z.string().trim().max(80).optional(),
  submissionType: z.string().trim().max(60).optional(),
  service: z.string().trim().max(80).optional(),
  pageUrl: z.string().url().max(300).optional(),
  uid: z.string().trim().max(128).optional(),
});

export const VolunteerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(32),
  governorate: z.string().trim().min(2).max(80),
  track: z.string().trim().min(2).max(100),
  motivation: z.string().trim().min(10).max(3000),
  hoursPerWeek: z.coerce.number().int().min(1).max(60).optional(),
});

export const DonationSchema = z.object({
  donorName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).optional(),
  amountEgp: z.coerce.number().positive().max(10_000_000),
  method: z.enum(['InstaPay', 'VodafoneCash', 'BankTransfer', 'Other']),
  referenceCode: z.string().trim().min(3).max(120),
  notes: z.string().trim().max(1000).optional(),
});

// Accepts both TF-YYYY-... and legacy TFU-YYYY-... credential serial formats
export const CertificateSerialSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(?:TF|TFU)-\d{4}-[A-Z0-9-]{2,24}$/, 'Serial must match TF-YYYY-XXXX or TFU-YYYY-XXXXXX');

export const RolePromoteSchema = z.object({
  uid: z.string().trim().min(6).max(128),
  role: z.enum(['student', 'member', 'volunteer', 'core_team', 'lead', 'admin', 'founder']),
  reason: z.string().trim().min(4).max(500).optional(),
});
