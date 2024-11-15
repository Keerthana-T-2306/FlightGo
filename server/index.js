import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { User, Booking, Flight } from './schemas.js';

const app = express();
const PORT = 6001;

app.use(express.json());
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/FlightBookingMERN', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB");

    // Register route
    app.post('/register', async (req, res) => {
        const { username, email, usertype, password } = req.body;
        let approval = 'approved';

        try {
            const existingUser = await User.findOne({ email });
            if (existingUser) return res.status(400).json({ message: 'User already exists' });

            if (usertype === 'flight-operator') approval = 'not-approved';

            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({ username, email, usertype, password: hashedPassword, approval });
            const userCreated = await newUser.save();
            return res.status(201).json(userCreated);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Server Error' });
        }
    });

    // Login route
    app.post('/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const user = await User.findOne({ email });
            if (!user) return res.status(401).json({ message: 'Invalid email or password' });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });
            
            return res.json(user);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Server Error' });
        }
    });

    // Approve flight operator
    app.post('/approve-operator', async (req, res) => {
        const { id } = req.body;
        try {
            const user = await User.findById(id);
            user.approval = 'approved';
            await user.save();
            res.json({ message: 'Operator approved' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Reject flight operator
    app.post('/reject-operator', async (req, res) => {
        const { id } = req.body;
        try {
            const user = await User.findById(id);
            user.approval = 'rejected';
            await user.save();
            res.json({ message: 'Operator rejected' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Fetch single user by ID
    app.get('/fetch-user/:id', async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            res.json(user);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Fetch all users
    app.get('/fetch-users', async (req, res) => {
        try {
            const users = await User.find();
            res.json(users);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Add flight
    app.post('/add-flight', async (req, res) => {
        const { flightName, flightId, origin, destination, departureTime, arrivalTime, basePrice, totalSeats } = req.body;
        try {
            const flight = new Flight({ flightName, flightId, origin, destination, departureTime, arrivalTime, basePrice, totalSeats });
            await flight.save();
            res.json({ message: 'Flight added' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Update flight details
    app.put('/update-flight', async (req, res) => {
        const { _id, flightName, flightId, origin, destination, departureTime, arrivalTime, basePrice, totalSeats } = req.body;
        try {
            const flight = await Flight.findById(_id);
            if (!flight) return res.status(404).json({ message: 'Flight not found' });

            flight.flightName = flightName;
            flight.flightId = flightId;
            flight.origin = origin;
            flight.destination = destination;
            flight.departureTime = departureTime;
            flight.arrivalTime = arrivalTime;
            flight.basePrice = basePrice;
            flight.totalSeats = totalSeats;

            await flight.save();
            res.json({ message: 'Flight updated' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Fetch all flights
    app.get('/fetch-flights', async (req, res) => {
        try {
            const flights = await Flight.find();
            res.json(flights);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Fetch a single flight by ID
    app.get('/fetch-flight/:id', async (req, res) => {
        try {
            const flight = await Flight.findById(req.params.id);
            res.json(flight);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Book a ticket
    app.post('/book-ticket', async (req, res) => {
        const { user, flight, flightName, flightId, departure, destination, email, mobile, passengers, totalPrice, journeyDate, journeyTime, seatClass } = req.body;
        try {
            const bookings = await Booking.find({ flight, journeyDate, seatClass });
            const numBookedSeats = bookings.reduce((acc, booking) => acc + booking.passengers.length, 0);

            let seats = "";
            const seatCode = { 'economy': 'E', 'premium-economy': 'P', 'business': 'B', 'first-class': 'A' };
            const coach = seatCode[seatClass];
            for (let i = numBookedSeats + 1; i < numBookedSeats + passengers.length + 1; i++) {
                seats = seats ? `${seats}, ${coach}-${i}` : `${coach}-${i}`;
            }

            const booking = new Booking({ user, flight, flightName, flightId, departure, destination, email, mobile, passengers, totalPrice, journeyDate, journeyTime, seatClass, seats });
            await booking.save();

            res.json({ message: 'Booking successful!' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    // Cancel a booking
    app.put('/cancel-ticket/:id', async (req, res) => {
        try {
            const booking = await Booking.findById(req.params.id);
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            booking.status = 'Cancelled';
            await booking.save();
            res.json({ message: 'Booking cancelled' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Server Error' });
        }
    });

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch((error) => {
    console.log(`Error connecting to MongoDB: ${error}`);
});
