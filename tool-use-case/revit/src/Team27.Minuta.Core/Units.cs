namespace Team27.Minuta.Core;

public static class Units
{
    public const double MetersPerFoot = 0.3048;

    public static double FeetToMeters(double feet) => feet * MetersPerFoot;

    public static double MetersToFeet(double meters) => meters / MetersPerFoot;

    public static double RoundMillimeters(double meters) => Math.Round(meters, 3, MidpointRounding.AwayFromZero) + 0.0;
}
