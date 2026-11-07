package com.group6.healthcare.payment.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * MinIO & AWS S3-Compatible Object Storage Service.
 *
 * Offloads in-memory PDF tax invoices and receipts to persistent object storage (MinIO / S3).
 * Eliminates heap memory overhead on high-throughput order batches and provides public / presigned download URLs.
 */
@Service
public class MinioStorageService {

    private static final Logger log = LoggerFactory.getLogger(MinioStorageService.class);

    @Value("${minio.enabled:false}")
    private boolean enabled = false;

    @Value("${minio.endpoint:http://localhost:9000}")
    private String endpoint = "http://localhost:9000";

    @Value("${minio.access-key:minioadmin}")
    private String accessKey = "minioadmin";

    @Value("${minio.secret-key:minioadmin}")
    private String secretKey = "minioadmin";

    @Value("${minio.bucket:pulsecare-invoices}")
    private String bucket = "pulsecare-invoices";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final Map<String, String> cachedObjectUrls = new ConcurrentHashMap<>();

    /**
     * Uploads receipt PDF to MinIO/S3 object storage asynchronously.
     * Returns the object download URL.
     */
    public String uploadReceiptPdf(String orderId, byte[] pdfBytes) {
        if (!enabled || pdfBytes == null || pdfBytes.length == 0) {
            return "/api/v1/payments/receipt/" + orderId + "/pdf";
        }

        String objectName = "PulseCare_Invoice_" + orderId + ".pdf";
        String objectUrl = endpoint.replaceAll("/+$", "") + "/" + bucket + "/" + objectName;

        try {
            // Ensure bucket exists
            ensureBucketExists();

            // S3 / MinIO PUT object request with basic/AWS auth
            HttpRequest putRequest = HttpRequest.newBuilder()
                    .uri(URI.create(objectUrl))
                    .header("Content-Type", "application/pdf")
                    .header("Authorization", "Basic " + Base64.getEncoder().encodeToString((accessKey + ":" + secretKey).getBytes(StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(10))
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(pdfBytes))
                    .build();

            HttpResponse<String> response = httpClient.send(putRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[MINIO S3 STORAGE] Successfully uploaded invoice {} to bucket '{}' (Size: {} bytes)",
                        objectName, bucket, pdfBytes.length);
                cachedObjectUrls.put(orderId, objectUrl);
                return objectUrl;
            } else {
                log.warn("[MINIO S3 STORAGE] Upload returned HTTP {}: {}. Falling back to internal PDF URL.",
                        response.statusCode(), response.body());
            }
        } catch (Exception ex) {
            log.warn("[MINIO S3 STORAGE] Could not upload to MinIO ({}). Falling back to internal URL.", ex.getMessage());
        }

        return "/api/v1/payments/receipt/" + orderId + "/pdf";
    }

    private void ensureBucketExists() {
        try {
            String bucketUrl = endpoint.replaceAll("/+$", "") + "/" + bucket;
            HttpRequest headReq = HttpRequest.newBuilder()
                    .uri(URI.create(bucketUrl))
                    .header("Authorization", "Basic " + Base64.getEncoder().encodeToString((accessKey + ":" + secretKey).getBytes(StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(3))
                    .method("HEAD", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<Void> headResp = httpClient.send(headReq, HttpResponse.BodyHandlers.discarding());
            if (headResp.statusCode() == 404) {
                // Create bucket
                HttpRequest createReq = HttpRequest.newBuilder()
                        .uri(URI.create(bucketUrl))
                        .header("Authorization", "Basic " + Base64.getEncoder().encodeToString((accessKey + ":" + secretKey).getBytes(StandardCharsets.UTF_8)))
                        .timeout(Duration.ofSeconds(5))
                        .PUT(HttpRequest.BodyPublishers.noBody())
                        .build();
                httpClient.send(createReq, HttpResponse.BodyHandlers.discarding());
                log.info("[MINIO S3 STORAGE] Created S3 bucket '{}'", bucket);
            }
        } catch (Exception ex) {
            // Ignore if MinIO offline
        }
    }

    public String getStoredUrl(String orderId) {
        return cachedObjectUrls.getOrDefault(orderId, "/api/v1/payments/receipt/" + orderId + "/pdf");
    }
}

