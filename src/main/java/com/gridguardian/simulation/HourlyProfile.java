package com.gridguardian.simulation;

import java.util.List;

public class HourlyProfile {

    private final List<Double> values;

    public HourlyProfile(List<Double> values) {

        if (values == null) {
            throw new IllegalArgumentException("Profile values cannot be null.");
        }

        if (values.size() != 24) {
            throw new IllegalArgumentException(
                    "Hourly profile must contain exactly 24 values."
            );
        }

        for (Double value : values) {
            if (value == null || value < 0) {
                throw new IllegalArgumentException(
                        "Profile values must be non-negative."
                );
            }
        }

        this.values = List.copyOf(values);
    }

    public double valueAt(int hour) {

        if (hour < 0 || hour > 23) {
            throw new IllegalArgumentException(
                    "Hour must be between 0 and 23."
            );
        }

        return values.get(hour);
    }

    public List<Double> values() {
        return values;
    }
}