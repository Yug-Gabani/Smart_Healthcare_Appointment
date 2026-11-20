import { pharmacyCommerceApi } from '../services/api';
import type { Prescription } from '../types';

/**
 * Reusable utility to add all prescribed medicines in a prescription to the patient's active cart.
 * Searches the pharmacy catalogue by drug name, checks stock, and adds 1 unit per medicine.
 * Returns an array of warning strings for any items out of stock or not found.
 */
export async function addPrescriptionToCart(rx: Prescription): Promise<string[]> {
  const warnings: string[] = [];

  if (!rx.items || rx.items.length === 0) {
    return ['This prescription does not contain any medications.'];
  }

  for (const item of rx.items) {
    try {
      // Search catalogue by drug name (case-insensitive, partial match via backend ILIKE)
      const result = await pharmacyCommerceApi.getMedicines({
        search: item.drugName,
        size: 5,
      });

      // Pick best match (exact name match first, or first result)
      const match =
        result.content.find(
          m => m.name.toLowerCase() === item.drugName.toLowerCase()
        ) ?? result.content[0];

      if (!match) {
        warnings.push(`"${item.drugName}" — not found in pharmacy catalogue`);
        continue;
      }

      if (match.stockQuantity < 1) {
        warnings.push(`"${match.name}" — currently out of stock`);
        continue;
      }

      // Add 1 unit per prescribed drug
      await pharmacyCommerceApi.addToCart(match.id, 1);
    } catch (err: any) {
      warnings.push(`"${item.drugName}" — could not be added (${err?.message ?? 'unknown error'})`);
    }
  }

  return warnings;
}

/**
 * 1-Click PDF downloader supporting desktop and mobile browsers.
 * Fetches the PDF with Authorization header, creates an object URL, and triggers download.
 */
export async function downloadPdfBlob(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem('pulsecare_token');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
}
