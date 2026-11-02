package com.group6.healthcare.config;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Exposes a {@link Cloudinary} client only when {@code app.cloudinary.cloud-name} is set.
 *
 * <p>Rationale: the bean's presence is the single switch that {@code FileStorageService} uses to
 * decide between remote (prod) and local-disk (dev) storage. If any of the three credentials is
 * missing we skip bean creation entirely so dev machines can run without an account.
 */
@Configuration
public class CloudinaryConfig {

    @Bean
    @ConditionalOnProperty(name = "app.cloudinary.cloud-name")
    public Cloudinary cloudinary(
            @Value("${app.cloudinary.cloud-name}") String cloudName,
            @Value("${app.cloudinary.api-key}")    String apiKey,
            @Value("${app.cloudinary.api-secret}") String apiSecret) {
        return new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key",    apiKey,
                "api_secret", apiSecret,
                "secure",     true
        ));
    }
}
