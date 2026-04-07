import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Contribution from "../models/Contribution";
import { errorHandler } from "../middleware/errorHandler";

/**
 * Create a new contribution record (PENDING by default).
 */
export const createContribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { amount, notes, memberId } = req.body;

    if (!amount) {
      return next(errorHandler(400, "Amount is required"));
    }

    // Generate a unique contribution number: CON-XXXXXX
    let contributionNumber = "";
    let isUnique = false;
    
    while (!isUnique) {
      contributionNumber = `CON-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const existing = await Contribution.findOne({ contributionNumber });
      if (!existing) isUnique = true;
    }

    const contribution = new Contribution({
      memberId: memberId || req.user?._id, // Allow setting memberId (for admins) or default to self
      contributionNumber,
      amount,
      notes,
      status: "PENDING"
    });

    await contribution.save();

    res.status(201).json({
      success: true,
      message: "Contribution record created successfully",
      data: contribution
    });
  } catch (error: any) {
    next(errorHandler(500, `Error creating contribution: ${error.message}`));
  }
};

/**
 * Get all contributions with pagination and filtering (Admin oversight).
 */
export const getContributions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const memberId = req.query.memberId as string;

    const query: any = {};

    if (status) {
      query.status = status.toUpperCase();
    }

    if (memberId) {
      query.memberId = memberId;
    }

    const total = await Contribution.countDocuments(query);
    const contributions = await Contribution.find(query)
      .populate("memberId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        contributions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching contributions: ${error.message}`));
  }
};

/**
 * Get contributions for the currently authenticated member.
 */
export const getMyContributions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const query: any = { memberId: req.user?._id };

    if (status) {
      query.status = status.toUpperCase();
    }

    const total = await Contribution.countDocuments(query);
    const contributions = await Contribution.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        contributions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching your contributions: ${error.message}`));
  }
};

/**
 * Get a specific contribution by ID.
 */
export const getContribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contribution = await Contribution.findById(req.params.id)
      .populate("memberId", "name email phone");

    if (!contribution) {
      return next(errorHandler(404, "Contribution record not found"));
    }

    // Security check: Only the owner or an admin/leader can view details
    const isOwner = req.user?._id.toString() === contribution.memberId._id.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied: You cannot view this contribution"));
    }

    res.status(200).json({
      success: true,
      data: contribution
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching contribution: ${error.message}`));
  }
};

/**
 * Delete a contribution record.
 * Only allowed for PENDING or CANCELLED status.
 */
export const deleteContribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contribution = await Contribution.findById(req.params.id);

    if (!contribution) {
      return next(errorHandler(404, "Contribution record not found"));
    }

    // Security check: Only the owner or an admin/leader can delete
    const isOwner = req.user?._id.toString() === contribution.memberId.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied: You cannot delete this contribution"));
    }

    // Only allow deletion of PENDING or CANCELLED contributions
    if (contribution.status === "COMPLETED") {
      return next(errorHandler(400, "Cannot delete a COMPLETED contribution"));
    }

    await Contribution.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Contribution record deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, `Error deleting contribution: ${error.message}`));
  }
};
