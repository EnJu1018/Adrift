import mongoose from 'mongoose';

const reactionTypes = ['understand', 'hug', 'relate'];

const diarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      default: '（未命名日記）'
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    mood: {
      type: {
        type: String,
        required: true,
        trim: true,
        enum: ['calm', 'joy', 'sad', 'wonder', 'anxious', 'nostalgic', 'other']
      },
      intensity: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      }
    },
    imageUrl: {
      type: String,
      default: ''
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value) {
            return value.length === 2 && value.every((number) => Number.isFinite(number));
          },
          message: 'Location coordinates must be [lng, lat]'
        }
      },
      placeName: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120
      }
    },
    locationAccuracy: {
      type: String,
      enum: ['precise', 'approximate'],
      default: 'precise'
    },
    visibility: {
      type: String,
      required: true,
      enum: ['private', 'friends', 'public'],
      default: 'private',
      index: true
    },
    reactions: {
      understand: {
        type: Number,
        default: 0,
        min: 0
      },
      hug: {
        type: Number,
        default: 0,
        min: 0
      },
      relate: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    reactedUsers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        type: {
          type: String,
          enum: reactionTypes,
          required: true
        }
      }
    ]
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        if (!ret.title) ret.title = '（未命名日記）';
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret) {
        if (!ret.title) ret.title = '（未命名日記）';
        return ret;
      }
    }
  }
);

diarySchema.pre('validate', function normalizeLocationAccuracy(next) {
  if (this.locationAccuracy !== 'approximate') {
    this.locationAccuracy = 'precise';
  }

  next();
});

diarySchema.index({ location: '2dsphere' });

export default mongoose.model('Diary', diarySchema);
