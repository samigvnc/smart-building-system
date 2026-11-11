package com.gridguardian.simulation;

public class Battery {

    private final double capacityKwh;
    private double socKwh;

    public Battery(double capacityKwh, double initialSocKwh) {
        if (capacityKwh < 0) {
            throw new IllegalArgumentException("Battery capacity cannot be negative.");
        }

        if (initialSocKwh < 0 || initialSocKwh > capacityKwh) {
            throw new IllegalArgumentException(
                    "Initial battery energy must be between 0 and capacity."
            );
        }

        this.capacityKwh = capacityKwh;
        this.socKwh = initialSocKwh;
    }

    public double charge(double requestedEnergyKwh) {
        if (requestedEnergyKwh < 0) {
            throw new IllegalArgumentException("Charge energy cannot be negative.");
        }

        double availableSpace = capacityKwh - socKwh;
        double acceptedEnergy = Math.min(requestedEnergyKwh, availableSpace);

        socKwh += acceptedEnergy;

        return acceptedEnergy;
    }

    public double discharge(double requestedEnergyKwh) {
        if (requestedEnergyKwh < 0) {
            throw new IllegalArgumentException("Discharge energy cannot be negative.");
        }

        double deliveredEnergy = Math.min(requestedEnergyKwh, socKwh);

        socKwh -= deliveredEnergy;

        return deliveredEnergy;
    }

    public double getCapacityKwh() {
        return capacityKwh;
    }

    public double getSocKwh() {
        return socKwh;
    }

    public double getSocPercentage() {
        if (capacityKwh == 0) {
            return 0;
        }

        return (socKwh / capacityKwh) * 100.0;
    }
}
