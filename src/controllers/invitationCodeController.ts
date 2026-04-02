import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import InvitationCode from "../models/InvitationCode";
import { errorHandler } from "../middleware/errorHandler";

/**
 * Generate a new invitation code.
 * Only accessible by Chairman (enforced by middleware).
 */
export const generateInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { expiresAt }: { expiresAt?: Date } = req.body;

    // Generate a unique 8-character uppercase code
    let code = "";
    let isUnique = false;
    
    while (!isUnique) {
      code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const existing = await InvitationCode.findOne({ code });
      if (!existing) isUnique = true;
    }

    const invitation = new InvitationCode({
      code,
      createdBy: req.user?._id,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
    });

    await invitation.save();

    res.status(201).json({
      success: true,
      message: "Invitation code generated successfully",
      data: invitation
    });
  } catch (error: any) {
    next(errorHandler(500, `Error generating invitation: ${error.message}`));
  }
};

/**
 * Get all invitation codes with pagination, search, and filtering.
 */
export const getInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const isUsed = req.query.isUsed as string;

    const query: any = {};

    if (search) {
      query.code = { $regex: search, $options: "i" };
    }

    if (isUsed !== undefined) {
      query.isUsed = isUsed === "true";
    }

    const total = await InvitationCode.countDocuments(query);
    const invitations = await InvitationCode.find(query)
      .populate("createdBy", "name email")
      .populate("usedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        invitations,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching invitations: ${error.message}`));
  }
};

/**
 * Get a specific invitation code by ID.
 */
export const getInvitationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invitation = await InvitationCode.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("usedBy", "name email");

    if (!invitation) {
      return next(errorHandler(404, "Invitation code not found"));
    }

    res.status(200).json({
      success: true,
      data: invitation
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching invitation: ${error.message}`));
  }
};

/**
 * Update an invitation code (e.g., extend expiry).
 */
export const updateInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { expiresAt, isUsed } = req.body;

    const invitation = await InvitationCode.findById(req.params.id);

    if (!invitation) {
      return next(errorHandler(404, "Invitation code not found"));
    }

    if (expiresAt) invitation.expiresAt = expiresAt;
    if (isUsed !== undefined) invitation.isUsed = isUsed;

    await invitation.save();

    res.status(200).json({
      success: true,
      message: "Invitation code updated successfully",
      data: invitation
    });
  } catch (error: any) {
    next(errorHandler(500, `Error updating invitation: ${error.message}`));
  }
};

/**
 * Delete an invitation code.
 */
export const deleteInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invitation = await InvitationCode.findById(req.params.id);

    if (!invitation) {
      return next(errorHandler(404, "Invitation code not found"));
    }

    if (invitation.isUsed) {
      return next(errorHandler(400, "Cannot delete a code that has already been used"));
    }

    await InvitationCode.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Invitation code deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, `Error deleting invitation: ${error.message}`));
  }
};
