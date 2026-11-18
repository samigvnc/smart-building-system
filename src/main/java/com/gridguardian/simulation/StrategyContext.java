package com.gridguardian.simulation;

import java.util.List;

public record StrategyContext(
        HourlyInput input,
        List<ScenarioCondition> conditions
) {

    public StrategyContext {
        if (input == null) {
            throw new IllegalArgumentException("Hourly input cannot be null.");
        }

        if (conditions == null) {
            throw new IllegalArgumentException("Scenario conditions cannot be null.");
        }

        conditions = List.copyOf(conditions);
    }

    public boolean hasGridOutageStartingWithin(int hours) {

        if (hours < 0) {
            throw new IllegalArgumentException("Look-ahead hours cannot be negative.");
        }

        int currentHour = input.hour();
        int latestHour = Math.min(23, currentHour + hours);

        return conditions
                .stream()
                .filter(condition -> condition.type() == ScenarioType.GRID_OUTAGE)
                .anyMatch(condition ->
                        condition.startHour() > currentHour
                                && condition.startHour() <= latestHour
                );
    }
}