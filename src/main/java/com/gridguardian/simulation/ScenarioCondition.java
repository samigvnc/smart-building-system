package com.gridguardian.simulation;

public record ScenarioCondition(
        ScenarioType type,
        int startHour,
        int endHour,
        double factor
) {

    public ScenarioCondition {
        if (type == null) {
            throw new IllegalArgumentException("Scenario type cannot be null.");
        }

        if (startHour < 0 || startHour > 23) {
            throw new IllegalArgumentException("Start hour must be between 0 and 23.");
        }

        if (endHour < 0 || endHour > 23) {
            throw new IllegalArgumentException("End hour must be between 0 and 23.");
        }

        if (startHour > endHour) {
            throw new IllegalArgumentException("Start hour cannot be greater than end hour.");
        }

        if (type == ScenarioType.CLOUDY_DAY && (factor < 0.0 || factor > 1.0)) {
            throw new IllegalArgumentException("Cloudy day factor must be between 0 and 1.");
        }

        if (type == ScenarioType.DEMAND_SPIKE && factor < 1.0) {
            throw new IllegalArgumentException("Demand spike factor must be at least 1.");
        }
    }

    public static ScenarioCondition normalDay() {
        return new ScenarioCondition(
                ScenarioType.NORMAL_DAY,
                0,
                23,
                1.0
        );
    }

    public static ScenarioCondition cloudyDay(
            int startHour,
            int endHour,
            double solarFactor
    ) {
        return new ScenarioCondition(
                ScenarioType.CLOUDY_DAY,
                startHour,
                endHour,
                solarFactor
        );
    }

    public static ScenarioCondition gridOutage(
            int startHour,
            int endHour
    ) {
        return new ScenarioCondition(
                ScenarioType.GRID_OUTAGE,
                startHour,
                endHour,
                1.0
        );
    }

    public static ScenarioCondition batteryFailure(
            int startHour,
            int endHour
    ) {
        return new ScenarioCondition(
                ScenarioType.BATTERY_FAILURE,
                startHour,
                endHour,
                1.0
        );
    }

    public static ScenarioCondition demandSpike(
            int startHour,
            int endHour,
            double demandFactor
    ) {
        return new ScenarioCondition(
                ScenarioType.DEMAND_SPIKE,
                startHour,
                endHour,
                demandFactor
        );
    }

    public boolean appliesAt(int hour) {
        return hour >= startHour && hour <= endHour;
    }
}