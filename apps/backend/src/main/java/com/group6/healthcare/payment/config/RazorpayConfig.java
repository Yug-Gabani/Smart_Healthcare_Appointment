package com.group6.healthcare.payment.config;

import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RazorpayConfig {

    @Value("${razorpay.key-id:rzp_test_TuvH1793SLzCcO}")
    private String keyId;

    @Value("${razorpay.key-secret:cpcqO1WzZ8PJNzCACG7JSKvp}")
    private String keySecret;

    @Bean
    public RazorpayClient razorpayClient() throws RazorpayException {
        return new RazorpayClient(keyId, keySecret);
    }

    @Bean(name = "razorpayKeyId")
    public String razorpayKeyId() {
        return keyId;
    }

    @Bean(name = "razorpayKeySecret")
    public String razorpayKeySecret() {
        return keySecret;
    }
}
